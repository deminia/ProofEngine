"""Automated tests for engine/llm.py extract_json_object utility.
Verifies:
1. Standard JSON objects
2. Nested objects and deep hierarchies
3. Arrays inside JSON
4. Markdown fences (```json ... ```)
5. Preamble and trailing commentary
6. Malformed JSON with braces in string values
7. Empty / non-JSON input
"""
import pytest
from engine.llm import extract_json_object


def test_extract_simple_json():
    text = '{"score": 8.5, "passed": true}'
    obj = extract_json_object(text)
    assert obj == {"score": 8.5, "passed": True}


def test_extract_nested_json():
    text = '''Here is your evaluation:
    {
        "status": "success",
        "scores": {
            "hook": 9,
            "clarity": 8.5,
            "details": {
                "tags": ["alpha", "beta"],
                "active": true
            }
        },
        "count": 42
    }
    Hope this helps!'''
    obj = extract_json_object(text)
    assert obj is not None
    assert obj["status"] == "success"
    assert obj["scores"]["details"]["tags"] == ["alpha", "beta"]
    assert obj["count"] == 42


def test_extract_markdown_fenced_json():
    text = '''```json
    {
        "title": "Fenced Title",
        "keywords": ["finance", "bubble"]
    }
    ```'''
    obj = extract_json_object(text)
    assert obj is not None
    assert obj["title"] == "Fenced Title"
    assert len(obj["keywords"]) == 2


def test_extract_json_with_braces_in_strings():
    text = '{"message": "Notice {this brace} is inside a string", "val": 100}'
    obj = extract_json_object(text)
    assert obj["val"] == 100
    assert "{this brace}" in obj["message"]


def test_extract_unparseable_returns_none():
    assert extract_json_object("") is None
    assert extract_json_object("Hello world, no JSON here!") is None
    assert extract_json_object("{malformed: no quotes on key") is None
