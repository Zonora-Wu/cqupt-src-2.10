#!/usr/bin/env python3
"""Refresh indexes and fields in a DOCX through a running LibreOffice instance."""

from __future__ import annotations

import argparse
from pathlib import Path
import time

import uno
from com.sun.star.beans import PropertyValue


def property_value(name: str, value):
    prop = PropertyValue()
    prop.Name = name
    prop.Value = value
    return prop


def file_url(path: Path) -> str:
    return uno.systemPathToFileUrl(str(path.resolve()))


def connect(port: int):
    local_context = uno.getComponentContext()
    resolver = local_context.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local_context
    )
    last_error = None
    for _ in range(30):
        try:
            return resolver.resolve(
                f"uno:socket,host=127.0.0.1,port={port};urp;StarOffice.ComponentContext"
            )
        except Exception as error:  # LibreOffice may still be starting.
            last_error = error
            time.sleep(0.5)
    raise RuntimeError("Unable to connect to LibreOffice") from last_error


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--port", type=int, default=2083)
    args = parser.parse_args()

    context = connect(args.port)
    desktop = context.ServiceManager.createInstanceWithContext(
        "com.sun.star.frame.Desktop", context
    )
    document = desktop.loadComponentFromURL(
        file_url(args.source),
        "_blank",
        0,
        (property_value("Hidden", True), property_value("ReadOnly", False)),
    )
    if document is None:
        raise RuntimeError(f"Unable to open {args.source}")

    try:
        for marker_text in ("[[SRS_TOC]]", "[[DOC_TOC]]"):
            search = document.createSearchDescriptor()
            search.SearchString = marker_text
            marker = document.findFirst(search)
            if marker is None:
                continue
            marker.setString("")
            index = document.createInstance("com.sun.star.text.ContentIndex")
            index.CreateFromOutline = True
            index.Level = 3
            index.Title = ""
            marker.getText().insertTextContent(marker, index, False)
        indexes = document.getDocumentIndexes()
        for index in indexes:
            index.update()
        document.getTextFields().refresh()
        args.destination.parent.mkdir(parents=True, exist_ok=True)
        document.storeAsURL(
            file_url(args.destination),
            (property_value("FilterName", "Office Open XML Text"),),
        )
    finally:
        document.close(True)


if __name__ == "__main__":
    main()
