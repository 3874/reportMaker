import logging, os, sys, json, requests, uuid
import googleapiclient.discovery
from flask import Flask, render_template, request, jsonify, send_from_directory
from tinydb import TinyDB, Query
from flask_cors import CORS
from datetime import datetime
from bs4 import BeautifulSoup
import urllib.parse  # 구글 검색 쿼리 인코딩용

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

# 디렉토리 생성
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(DB_FOLDER, exist_ok=True)
os.makedirs(SETTING_FOLDER, exist_ok=True)

# 데이터베이스 경로 설정
db_path = os.path.join(DB_FOLDER, 'fileDB.json')
db_path2 = os.path.join(DB_FOLDER, 'companyDB.json')
db_path3 = os.path.join(DB_FOLDER, 'projectDB.json')

# 데이터베이스 초기화
db = TinyDB(db_path)
db2 = TinyDB(db_path2)
db3 = TinyDB(db_path3)

# 테이블 생성
fileTable = db.table('fileTable')
companyTable = db2.table('companyTable')
projectTable = db3.table('projectTable')

# 설정 파일 경로
config_path = os.path.join(SETTING_FOLDER, "config.json")
if not os.path.exists(config_path):
    raise FileNotFoundError("Config file not found. Ensure config.json exists in the setting directory.")

with open(config_path, "r") as json_file:
    QR_config = json.load(json_file)

if not QR_config or not QR_config.get('OPENAI_KEY'):
    raise ValueError('OpenAI Key is missing in the config file.')

@FFapp.route('/')
def home():
    return render_template('projectlist.html')

@FFapp.route('/<page>')
def render_page(page):
    return render_template(f'{page}.html')

@FFapp.route('/uploadFile', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400

    # 예시: 파일 확장자 제한 (필요 시 활성화)
    # ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'}
    # if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in ALLOWED_EXTENSIONS:
    #     return jsonify({'error': 'File type not allowed.'}), 400

    file_name = file.filename
    file.seek(0)
    file_size = len(file.read())
    file.seek(0)

    file_path = os.path.join(UPLOAD_FOLDER, file_name)

    if os.path.exists(file_path):
        existing_file_size = os.path.getsize(file_path)
        if existing_file_size == file_size:
            return jsonify({'error': 'File already exists with the same name and size.'}), 400

    try:
        file.save(file_path)
        logging.info(f'File uploaded and saved: {file_path}')
    except Exception as e:
        logging.error(f'Error saving file: {str(e)}')
        return jsonify({'error': 'Could not save the file.'}), 500

    file_id = str(uuid.uuid4())
    current_time = datetime.now().isoformat()
    
    new_entry = {
        'fileId': file_id,
        'file_name': file_name,
        'location': file_path,
        'tags': [],
        'summary': '',
        'comments': '',
        'createdAt': current_time,
        'updatedAt': current_time
    }

    fileTable.insert(new_entry)

    return jsonify({'success': True, 'data': new_entry}), 201

@FFapp.route('/updateFile/<string:fileId>', methods=['PUT'])
def update_file(fileId):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400
    logging.debug(f"Update file data: {data}")
    File = Query()
    file_entry = fileTable.get(File.fileId == fileId)

    if not file_entry:
        return jsonify({'error': 'File not found.'}), 404
    
    # tags 문자열을 콤마로 분리 (필요 시 strip() 등 추가)
    tag_array = data.get('tags', '').split(',')
    update_data = {
        'summary': data.get('summary', ''),
        'comments': data.get('comments', ''),
        'tags': tag_array,
        'updatedAt': datetime.now().isoformat()
    }
    fileTable.update(update_data, Query().fileId == fileId)

    # 업데이트 후 다시 가져오기
    file_entry = fileTable.get(File.fileId == fileId)
    return jsonify({'success': True, 'data': file_entry}), 200

@FFapp.route('/removeFile/<string:fileId>', methods=['DELETE'])
def remove_file(fileId):
    File = Query()
    file_entry = fileTable.get(File.fileId == fileId)
    
    if not file_entry:
        return jsonify({'error': 'File not found.'}), 404

    # 파일 경로 가져오기
    file_path = file_entry['location']

    # 데이터베이스에서 파일 정보 삭제
    fileTable.remove(Query().fileId == fileId)
    
    # 실제 파일 시스템에서 파일 삭제
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
        else:
            logging.warning(f'File not found in the filesystem: {file_path}')
    except Exception as e:
        logging.error(f'Error deleting file: {str(e)}')
        return jsonify({'error': 'Could not delete the file from the filesystem.'}), 500

    return jsonify({'success': True}), 200

@FFapp.route('/findFile/<string:fileId>', methods=['GET'])
def find_file(fileId):
    File = Query()
    file_entry = fileTable.get(File.fileId == fileId)
    
    if not file_entry:
        return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404

    return jsonify({'success': True, 'data': file_entry}), 200

@FFapp.route('/complexSearch', methods=['POST'])
def complex_search():
    data = request.get_json()

    if not isinstance(data, list) or len(data) == 0:
        return jsonify({'error': 'Invalid data format'}), 400
    
    YlemURL = f"{QR_config.get('n8n_URL')}/webhook/complex-search"

    try:
        response = requests.post(
            YlemURL,
            json=[{
                "sessionId": data[0].get('sessionId'),
                "action": data[0].get('action'),
                "chatInput": data[0].get('chatInput')
            }]
        )
        response.raise_for_status()
        return response.content
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': f'HTTP error occurred: {str(e)}'}), 500
    except requests.exceptions.ConnectionError as e:
        return jsonify({'error': f'Connection error occurred: {str(e)}'}), 500
    except requests.exceptions.Timeout as e:
        return jsonify({'error': f'Timeout error occurred: {str(e)}'}), 500
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@FFapp.route('/addVectorDB', methods=['POST'])
def add_vector_db():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400

    temp_file_path = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(temp_file_path)

    pdfExtracURL = f"{QR_config.get('n8n_URL')}/webhook/addpdfinvectordb"
    try:
        with open(temp_file_path, 'rb') as f:
            response = requests.post(
                pdfExtracURL,
                files={'file': f}
            )
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@FFapp.route('/searchFile', methods=['GET'])
def search_file():
    keywords = request.args.get('keywords', '')
    keywords_list = keywords.split()
    
    if not keywords_list:
        return jsonify({'error': 'No keywords provided.'}), 400

    File = Query()
    query = None
    for keyword in keywords_list:
        if query is None:
            query = (File.file_name.search(keyword) | 
                     File.tags.search(keyword) | 
                     File.summary.search(keyword) |
                     File.comments.search(keyword))
        else:
            query &= (File.file_name.search(keyword) | 
                      File.tags.search(keyword) | 
                      File.summary.search(keyword) |
                      File.comments.search(keyword))
    
    results = fileTable.search(query)
    return jsonify({'success': True, 'results': results}), 200

@FFapp.route('/files', methods=['GET'])
def get_files():
    start = int(request.args.get('start', 0))
    length = int(request.args.get('length', 10))
    search_value = request.args.get('search[value]', '').lower()
    
    files = fileTable.all()
    if search_value:
        files = [file for file in files if (
            search_value in file['file_name'].lower() or
            search_value in file.get('summary', '').lower() or
            search_value in file.get('comments', '').lower() or 
            any(search_value in tag.lower() for tag in file.get('tags', []))
        )]
    
    records_with_id = [{'fileId': file['fileId'], **file} for file in files]
    records_with_id.reverse()
    paginated_files = records_with_id[start:start + length]
    
    response = {
        "draw": int(request.args.get('draw', 1)),
        "recordsTotal": len(fileTable.all()),
        "recordsFiltered": len(records_with_id),
        "data": paginated_files
    }
    return jsonify(response)

@FFapp.route('/downloadFile/<fileId>', methods=['GET'])
def download_file(fileId):
    File = Query()
    file_entry = fileTable.get(File.fileId == fileId)

    if not file_entry:
        return jsonify({'error': 'File not found.'}), 404

    file_name = file_entry['file_name']
    logging.debug(f"Downloading file from folder: {UPLOAD_FOLDER}")
    return send_from_directory(UPLOAD_FOLDER, file_name)

@FFapp.route('/newProject', methods=['POST'])
def new_project():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400

    title = data.get('title')
    summary = data.get('summary')
    contents = data.get('contents')
    related_files = data.get('related_files', [])
    related_companies = data.get('related_companies', [])
    
    project_id = str(uuid.uuid4())
    current_time = datetime.now().isoformat()
    new_entry = {
        'projectId': project_id,
        'title': title,
        'summary': summary,
        'contents': contents,
        'related_files': related_files,
        'related_companies': related_companies,
        'createdAt': current_time,
        'updatedAt': current_time
    }

    projectTable.insert(new_entry)

    return jsonify({'success': True, 'data': new_entry}), 201

@FFapp.route('/updateProject/<string:projectId>', methods=['PUT'])
def update_project(projectId):
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400

    Project = Query()
    project_entry = projectTable.get(Project.projectId == projectId)
    if not project_entry:
        return jsonify({'error': 'Project not found.'}), 404
    
    update_data = {}
    for key, value in data.items():
        # 필요에 따라 업데이트 가능한 키를 제한할 수 있음
        if value is not None:
            update_data[key] = value

    update_data['updatedAt'] = datetime.now().isoformat()

    projectTable.update(update_data, Query().projectId == projectId)
    project_entry = projectTable.get(Project.projectId == projectId)
    return jsonify({'success': True, 'data': project_entry}), 200

@FFapp.route('/removeProject/<string:projectId>', methods=['DELETE'])
def remove_project(projectId):
    Project = Query()
    result = projectTable.remove(Query().projectId == projectId)
    if result == 0:
        return jsonify({'error': 'Project not found.'}), 404

    return jsonify({'success': True}), 200

@FFapp.route('/findProject/<string:projectId>', methods=['GET'])
def find_project(projectId):
    Project = Query()
    project_entry = projectTable.get(Query().projectId == projectId)
    
    if not project_entry:
        return jsonify({'error': '프로젝트를 찾을 수 없습니다.'}), 404

    return jsonify({'success': True, 'data': project_entry}), 200

@FFapp.route('/searchProject', methods=['GET'])
def search_project():
    keywords = request.args.get('keywords', '')
    keywords_list = keywords.split()
    
    if not keywords_list:
        return jsonify({'error': 'No keywords provided.'}), 400

    Project = Query()
    query = None
    for keyword in keywords_list:
        if query is None:
            query = (Project.title.search(keyword) | 
                     Project.summary.search(keyword) | 
                     Project.contents.search(keyword))
        else:
            query &= (Project.title.search(keyword) | 
                      Project.summary.search(keyword) |
                      Project.contents.search(keyword))
    
    results = projectTable.search(query)
    return jsonify({'success': True, 'results': results}), 200

@FFapp.route('/projects', methods=['GET'])
def get_projects():
    start = int(request.args.get('start', 0))
    length = int(request.args.get('length', 10))
    search_value = request.args.get('search[value]', '').lower()
    
    projects = projectTable.all()
    if search_value:
        projects = [proj for proj in projects if (
            search_value in proj['title'].lower() or
            search_value in proj.get('summary', '').lower() or
            search_value in proj.get('contents', '').lower()
        )]
    
    records_with_id = [{'projectId': proj['projectId'], **proj} for proj in projects]
    records_with_id.reverse()
    paginated_projects = records_with_id[start:start + length]
    
    response = {
        "draw": int(request.args.get('draw', 1)),
        "recordsTotal": len(projectTable.all()),
        "recordsFiltered": len(records_with_id),
        "data": paginated_projects
    }
    return jsonify(response)

@FFapp.route('/companies', methods=['GET'])
def get_companies():
    start = int(request.args.get('start', 0))
    length = int(request.args.get('length', 10))
    search_value = request.args.get('search[value]', '').lower()  # 수정된 부분
    
    companies = companyTable.all()
    if search_value:
        companies = [company for company in companies if (
            search_value in company['companyName'].lower() or
            search_value in company['companyEnName'].lower() or
            search_value in company.get('industry', '').lower() or
            search_value in company.get('summary', '').lower() or
            search_value in company.get('comment', '').lower()
        )]

    records_with_id = [{'companyId': company['companyId'], **company} for company in companies]
    records_with_id.reverse()
    paginated_companies = records_with_id[start:start + length]
    
    response = {
        "draw": int(request.args.get('draw', 1)),
        "recordsTotal": len(companyTable.all()),
        "recordsFiltered": len(companies),
        "data": paginated_companies
    }
    return jsonify(response)

@FFapp.route('/addCompany', methods=['POST'])
def add_company():
    data = request.get_json()
    if data:
        companyName = data.get('companyName')
        companyEnName = data.get('companyEnName')
        industry = data.get('industry')
        summary = data.get('summary')
        comment = data.get('comment')

        company_id = str(uuid.uuid4())
        current_time = datetime.now().isoformat()
    
        company_data = {
            'companyId': company_id,
            'companyName': companyName,
            'companyEnName': companyEnName,
            'industry': industry,
            'summary': summary,
            'comment': comment,
            'createdAt': current_time,
        }

        companyTable.insert(company_data) 

        return jsonify({'success': True, 'message': 'Company added successfully!'}), 201
    return jsonify({'success': False, 'message': 'Invalid data'}), 400

@FFapp.route('/updateCompany/<string:companyId>', methods=['PUT'])
def update_company(companyId):
    data = request.get_json()

    if not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400
    
    Company = Query()
    company_entry = companyTable.get(Query().companyId == companyId)

    if not company_entry:
        return jsonify({'error': 'Company not found.'}), 404
    
    update_data = {}
    for key, value in data.items():
        if value is not None:
            update_data[key] = value

    update_data['updatedAt'] = datetime.now().isoformat()

    companyTable.update(update_data, Query().companyId == companyId)
    company_entry = companyTable.get(Query().companyId == companyId)
    return jsonify({'success': True, 'data': company_entry}), 200

@FFapp.route('/deleteCompany/<string:companyId>', methods=['DELETE'])
def delete_company(companyId):
    Company = Query()
    company_entry = companyTable.get(Query().companyId == companyId)

    if not company_entry:
        return jsonify({'error': 'Company not found.'}), 404
    
    companyTable.remove(doc_ids=[company_entry.doc_id])
    return jsonify({'success': True, 'message': 'Company deleted successfully!'}), 200

@FFapp.route('/saveSettings', methods=['POST'])
def save_settings():
    data = request.get_json()
    if data:
        openai_key = data.get('OPENAI_KEY')
        serp_api = data.get('serpAPI')
        n8n_url = data.get('n8n_URL')
        port = data.get('port')

        config_path_local = os.path.join(SETTING_FOLDER, 'config.json')
        with open(config_path_local, 'r+') as config_file:
            config = json.load(config_file)
            config['OPENAI_KEY'] = openai_key
            config['serpAPI'] = serp_api
            config['n8n_URL'] = n8n_url
            config['port'] = port
            config_file.seek(0)
            json.dump(config, config_file, indent=4)
            config_file.truncate()

        return jsonify({'success': True}), 200
    return jsonify({'success': False, 'message': 'Invalid data'}), 400

@FFapp.errorhandler(Exception)
def handle_exception(e):
    logging.error(f"Server error: {str(e)}")
    return jsonify({'error': 'An unexpected error occurred.'}), 500

@FFapp.route('/getPrompts', methods=['GET'])
def get_prompts():
    prompt_path = os.path.join(SETTING_FOLDER, "prompts.json")
    if not os.path.exists(prompt_path):
        raise FileNotFoundError("Prompts file not found. Ensure prompts.json exists in the setting directory.")

    with open(prompt_path, "r") as json_file2:
        FF_prompts = json.load(json_file2)
    return jsonify({'success': True, 'data': FF_prompts}), 200

@FFapp.route('/updatePrompts', methods=['PUT'])
def update_prompts():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400
    prompt_path = os.path.join(SETTING_FOLDER, "prompts.json")

    if not os.path.exists(prompt_path):
        raise FileNotFoundError("Prompts file not found. Ensure prompts.json exists in the setting directory.")

    with open(prompt_path, "w") as json_file:
        json.dump(data, json_file, indent=4)
    
    with open(prompt_path, "r") as json_file2:
        FF_prompts = json.load(json_file2)

    return jsonify({'success': True, 'data': FF_prompts}), 200

@FFapp.route('/getSettings', methods=['GET'])
def get_settings():
    config_path_local = os.path.join(SETTING_FOLDER, "config.json")
    if not os.path.exists(config_path_local):
        raise FileNotFoundError("Config file not found. Ensure config.json exists in the setting directory.")

    with open(config_path_local, "r") as json_file2:
        FF_configs = json.load(json_file2)
    return jsonify({'success': True, 'data': FF_configs}), 200

@FFapp.route('/backupData', methods=['POST'])
def backup_data():
    try:
        with open(db_path, 'r') as f:
            file_data = json.load(f)
        with open(db_path2, 'r') as f:
            company_data = json.load(f)
        with open(db_path3, 'r') as f:
            project_data = json.load(f)

        backup_url = "https://example.com/backup" 
        headers = {
            'Authorization': f'Bearer {QR_config["FileFlicker_API_KEY"]}',
            'Content-Type': 'application/json'
        }
        response = requests.post(backup_url, json={
            'fileDB': file_data,
            'companyDB': company_data,
            'projectDB': project_data
        }, headers=headers) 
        response.raise_for_status()

        return jsonify({'success': True, 'message': 'Backup completed successfully.'}), 200
    except Exception as e:
        logging.error(f"Error during backup: {e}")
        return jsonify({'error': 'An error occurred during backup.'}), 500

@FFapp.route('/AISearch', methods=['POST'])
def AI_search():
    data = request.get_json()
    if not data or not isinstance(data, list) or not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400
    
    chatInput = data[0].get('chatInput', '') 
    AI_url = 'https://api.openai.com/v1/chat/completions'
    search_results = chat_with_openai(AI_url, chatInput)
    
    return jsonify({'reply': search_results})

@FFapp.route('/googleSearch', methods=['POST'])
def google_search_BS():
    data = request.get_json()
    num_results = 30
    if not data or not isinstance(data, list) or not data:
        return jsonify({'error': 'Invalid JSON data.'}), 400
    
    chatInput = data[0].get('chatInput', '') 
    url1 = 'https://api.openai.com/v1/chat/completions'
    resp = chat_with_openai(url1, f"Extract the key keywords from the following text and provide a brief description for each keyword: '{chatInput}' Present the results in a structured format with keywords and their descriptions.")
    
    headers = {
        'User-Agent': 'Mozilla/5.0'
    }
    # 구글 검색 쿼리 안전하게 인코딩
    encoded_query = urllib.parse.quote_plus(resp)
    search_url = f"https://www.google.com/search?q={encoded_query}&num={num_results}"
    
    response = requests.get(search_url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    search_results = []
    for g in soup.find_all('div', class_='g'):
        title = g.find('h3').text if g.find('h3') else 'No title'
        a_tag = g.find('a')
        link = a_tag['href'] if a_tag and 'href' in a_tag.attrs else 'No link'
        snippet = g.find('span', class_='aCOpRe').text if g.find('span', class_='aCOpRe') else 'No snippet'
        
        search_results.append({
            'title': title,
            'url': link,
            'snippet': snippet
        })

    return jsonify({'reply': search_results})

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

def google_search_api(query, num_results=10):
    service = googleapiclient.discovery.build("customsearch", "v1", developerKey=QR_config["GOOGLE_API_KEY"])
    res = service.cse().list(q=query, cx=QR_config["SEARCH_ENGINE_ID"], num=num_results).execute()
    return res.get('items', [])

if __name__ == '__main__':
    port = int(QR_config.get('port', 5000))
    FFapp.run(host='0.0.0.0', port=port, debug=True)
