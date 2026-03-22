from flask import Blueprint, request, jsonify
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

ai_bp = Blueprint('ai', __name__)

OPENAI_KEY = os.getenv('OPENAI_API_KEY')
GEMINI_KEY = os.getenv('GEMINI_API_KEY')
CLAUDE_KEY = os.getenv('CLAUDE_API_KEY')
HF_KEY = os.getenv('HF_API_KEY')

SYSTEM_PROMPT = """You are a knowledgeable culinary nutritionist and cooking assistant for SpiceRoute.
DIETARY RESTRICTION: This website is strictly BEEF-FREE. You must never provide recipes or nutrition info for beef, steak, or related bovine meat. If asked about beef, politely explain that SpiceRoute only features beef-free recipes.
PORK IS ALLOWED: You may provide information and recipes related to pork (bacon, ham, etc.).

When given a recipe name and ingredients, provide:
1. Estimated macros per serving (calories, protein, carbs, fat)
2. Spice level (Mild / Medium / Hot / Very Hot)
3. Health impact summary (2-3 sentences)
4. 2-3 practical cooking tips
5. Any ingredient substitution suggestions for healthier alternatives

Keep responses concise, friendly and practical. Format with clear sections."""


def call_huggingface(messages):
    from huggingface_hub import InferenceClient
    client = InferenceClient(api_key=HF_KEY)
    
    # Format messages for the chat completion API
    try:
        response = client.chat.completions.create(
            model="meta-llama/Llama-3.2-1B-Instruct",
            messages=messages,
            max_tokens=600
        )
        return response.choices[0].message.content
    except Exception as e:
        # Fallback to a different model if Llama is busy
        print(f"[HF Fallback] Primary model failed, trying alternative: {str(e)}")
        response = client.chat.completions.create(
            model="mistralai/Mistral-7B-Instruct-v0.3",
            messages=messages,
            max_tokens=600
        )
        return response.choices[0].message.content


def call_openai(messages):
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_KEY)
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        max_tokens=600
    )
    return res.choices[0].message.content


def call_gemini(messages):
    import requests
    prompt = "\n".join([m['content'] for m in messages if m.get('content')])
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    res = requests.post(url, json=payload, timeout=30)
    res.raise_for_status()
    return res.json()['candidates'][0]['content']['parts'][0]['text']


def call_claude(messages):
    import anthropic
    client = anthropic.Anthropic(api_key=CLAUDE_KEY)
    # Separate system from user messages
    system_msg = next((m['content'] for m in messages if m['role'] == 'system'), '')
    user_msgs = [m for m in messages if m['role'] != 'system']
    res = client.messages.create(
        model="claude-3-haiku-20240307",
        max_tokens=600,
        system=system_msg,
        messages=user_msgs
    )
    return res.content[0].text


def ask_ai(messages):
    """Try HuggingFace → Gemini → OpenAI → Claude with fallback."""
    providers = [
        ('HuggingFace', call_huggingface),
        ('Gemini', call_gemini),
        ('OpenAI', call_openai),
        ('Claude', call_claude),
    ]
    last_error = None
    for name, fn in providers:
        try:
            result = fn(messages)
            return result, name
        except Exception as e:
            err = str(e)
            print(f"[AI Fallback] {name} failed: {err}")
            if 'quota' in err.lower() or '429' in err or 'insufficient_quota' in err:
                last_error = f"{name} API quota exceeded"
            else:
                last_error = err
    raise Exception(f"AI unavailable — all API keys have exceeded their quota. Please add a new API key in back-end/.env")


@ai_bp.route('/api/ai/nutrition', methods=['POST'])
def get_nutrition():
    data = request.get_json()
    recipe_name = data.get('recipe_name', '')
    ingredients = data.get('ingredients', [])
    
    ingredients_str = ', '.join(ingredients) if ingredients else 'unspecified'
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Recipe: {recipe_name}\nIngredients: {ingredients_str}\n\nPlease provide the full nutritional analysis and cooking tips."}
    ]
    
    try:
        response, provider = ask_ai(messages)
        return jsonify({"success": True, "response": response, "provider": provider})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@ai_bp.route('/api/ai/chat', methods=['POST'])
def chat():
    data = request.get_json()
    recipe_name = data.get('recipe_name', '')
    ingredients = data.get('ingredients', [])
    question = data.get('question', '')
    history = data.get('history', [])  # [{role, content}, ...]

    ingredients_str = ', '.join(ingredients) if ingredients else 'unspecified'
    
    messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\nContext - Recipe: {recipe_name}, Ingredients: {ingredients_str}"}
    ] + history + [
        {"role": "user", "content": question}
    ]

    try:
        response, provider = ask_ai(messages)
        return jsonify({"success": True, "response": response, "provider": provider})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
