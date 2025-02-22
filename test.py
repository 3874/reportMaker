import logging, unicodedata
import os
import sys
import json
import requests
from flask import Flask, render_template, request, jsonify, send_from_directory
from tinydb import TinyDB, Query
from flask_cors import CORS
from datetime import datetime
from bs4 import BeautifulSoup



# 로깅 설정
logging.basicConfig(level=logging.INFO)

FFapp = Flask(__name__)
CORS(FFapp)

# 기본 디렉토리 설정
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TEMPLATE_FOLDER = os.path.join(BASE_DIR, 'templates')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'drive')
DB_FOLDER = os.path.join(BASE_DIR, 'db')
SETTING_FOLDER = os.path.join(BASE_DIR, 'setting')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)

db_path = os.path.join(DB_FOLDER, 'fileDB.json')
db = TinyDB(db_path)
fileTable = db.table('fileTable')

config_path = os.path.join(SETTING_FOLDER, "config.json")
if not os.path.exists(config_path):
    raise FileNotFoundError("Config file not found. Ensure config.json exists in the setting directory.")

with open(config_path, "r") as json_file:
    QR_config = json.load(json_file)

def chat_with_openai(Requrl, chatInput):
    url = Requrl
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {QR_config["OPENAI_KEY"]}'
    }

    data = {
        'model': "gpt-4o-mini",
        'messages': [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": chatInput}
        ],
        'max_tokens': 4096,
        'temperature': 0.7
    }

    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        result = response.json()
        logging.info('Response received from OpenAI API')
        summary = result['choices'][0]['message']['content'].strip()
        return summary
    except requests.exceptions.HTTPError as err:
        logging.error(f'HTTP error occurred: {err}')
        try:
            error_details = response.json()
            logging.error(f'Error details: {error_details}')
        except Exception:
            logging.error('No error details available.')
        return "An error occurred while processing your request."
    except Exception as ex:
        logging.error(f'Unexpected error: {ex}')
        return "An unexpected error occurred."

def extract_text_from_file(file_path):
    # 파일에서 텍스트를 추출하는 함수
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except UnicodeDecodeError:
        # utf-8로 읽을 수 없는 경우 다른 인코딩 시도
        try:
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read()
        except Exception as e:
            logging.error(f'Error reading file {file_path}: {e}')
            return None  # 파일 읽기 실패 시 None 반환
        
def split_text(text, max_length=100000):
    # 주어진 텍스트를 최대 길이에 맞게 분할하는 함수
    return [text[i:i + max_length] for i in range(0, len(text), max_length)]

def update_summaries():
    for item in fileTable.all():
        fileName = unicodedata.normalize('NFC', item.get('file_name'))
        summary = unicodedata.normalize('NFC', item.get('summary'))
        fileTable.update({'file_name':fileName,'summary': summary}, Query().fileId == item.get('fileId'))
        logging.info(f'Updated summary for location: {item.get('fileId')}')

    else:
        logging.warning(f'Location not found or does not exist: {item.get('fileId')}')

if __name__ == "__main__":
    # 요약 업데이트 함수 호출
    update_summaries()
    
    # Flask 애플리케이션 실행
    FFapp.run(host='0.0.0.0', port=5000, debug=True)