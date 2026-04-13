"""
services/gemini_service.py
Wrapper around google-generativeai for multi-turn conversations.
"""
import os
import json
import traceback
from fastapi import HTTPException
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    print("WARNING: Missing GEMINI_API_KEY")
else:
    genai.configure(api_key=GEMINI_API_KEY)

MODEL_NAME = "gemini-2.5-flash-lite"


def _build_contents(history: list[dict], user_message: str) -> list[dict]:
    """
    Convert stored history + new user message into Gemini-compatible content list.
    History format: [{"role": "user"|"model", "parts": ["text"]}]
    """
    contents = []
    for item in history:
        contents.append({
            "role": item.get("role", "user"),
            "parts": item.get("parts", [""])
        })
    # Append the current user turn
    contents.append({"role": "user", "parts": [user_message]})
    return contents


def chat(
    system_prompt: str,
    history: list[dict],
    user_message: str
) -> str:
    """
    Send a multi-turn chat message to Gemini.
    Returns the model's text reply.

    Args:
        system_prompt: Context/instruction prepended as system instruction.
        history: Previous turns from Redis (list of {role, parts}).
        user_message: The new user message.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    try:
        model = genai.GenerativeModel(
            model_name=MODEL_NAME,
            system_instruction=system_prompt
        )
        contents = _build_contents(history, user_message)
        response = model.generate_content(contents)
        return response.text.strip()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")


def one_shot(prompt: str) -> str:
    """
    Single-turn prompt — no history. Used for one-shot recommendations/summaries.
    Returns plain text response.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    try:
        model = genai.GenerativeModel(model_name=MODEL_NAME)
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=502, detail=f"Gemini error: {e}")
