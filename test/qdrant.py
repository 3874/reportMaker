import requests

def create_collection():
    # 컬렉션 생성 로직
    collection_name = input("생성할 컬렉션 이름을 입력하세요: ")
    response = requests.put(f"http://localhost:6333/collections/{collection_name}")  # POST -> PUT으로 변경
    if response.status_code == 200:
        print(f"컬렉션 '{collection_name}'이(가) 성공적으로 생성되었습니다.")
    else:
        print("컬렉션 생성 중 오류 발생:", response.text)

def delete_collection():
    # 컬렉션 조회 후 삭제할 컬렉션 선택
    collections = view_collections()
    if collections:
        collection_name = input("삭제할 컬렉션 이름을 입력하세요: ")
        if collection_name in collections:
            response = requests.delete(f"http://localhost:6333/collections/{collection_name}")
            if response.status_code == 200:
                print(f"컬렉션 '{collection_name}'이(가) 성공적으로 삭제되었습니다.")
            else:
                print("컬렉션 삭제 중 오류 발생:", response.text)
        else:
            print("해당 컬렉션이 존재하지 않습니다.")
    else:
        print("삭제할 컬렉션이 없습니다.")

def view_collections():
    # 컬렉션 조회 로직
    response = requests.get("http://localhost:6333/collections")
    if response.status_code == 200:
        try:
            collections_response = response.json()  # API 응답
            print("API 응답:", collections_response)  # API 응답 출력
            
            # 수정된 부분: 'result' 키를 통해 'collections'에 접근
            collections = collections_response.get('result', {}).get('collections', [])
            
            if isinstance(collections, list):  # collections가 리스트인지 확인
                if collections:
                    print("현재 컬렉션 목록:")
                    collection_names = [collection['name'] for collection in collections]
                    for name in collection_names:
                        print(f"- {name}")
                    return collection_names
                else:
                    print("현재 컬렉션이 없습니다.")
                    return []
            else:
                print("컬렉션 데이터 형식이 올바르지 않습니다:", collections)
                return []
        except ValueError:
            print("JSON 파싱 중 오류 발생:", response.text)
            return []
    else:
        print("컬렉션 조회 중 오류 발생:", response.text)
        return []

def add_data_to_collection():
    # 컬렉션에 데이터 추가
    collection_name = input("데이터를 추가할 컬렉션 이름을 입력하세요: ")
    data = input("추가할 데이터를 입력하세요: ")
    response = requests.post(f"http://localhost:6333/collections/{collection_name}/points", json={"data": data})  # 잘못된 엔드포인트 수정
    if response.status_code == 200:
        print("데이터가 성공적으로 추가되었습니다.")
    else:
        print("데이터 추가 중 오류 발생:", response.text)

def delete_data_from_collection():
    # 컬렉션에서 데이터 삭제
    collection_name = input("데이터를 삭제할 컬렉션 이름을 입력하세요: ")
    data_id = input("삭제할 데이터의 ID를 입력하세요: ")
    response = requests.delete(f"http://localhost:6333/collections/{collection_name}/points/{data_id}")  # 잘못된 엔드포인트 수정
    if response.status_code == 200:
        print("데이터가 성공적으로 삭제되었습니다.")
    else:
        print("데이터 삭제 중 오류 발생:", response.text)

def view_collection_details():
    # 특정 컬렉션의 세부 정보 조회
    collection_name = input("세부 정보를 조회할 컬렉션 이름을 입력하세요: ")
    response = requests.get(f"http://localhost:6333/collections/{collection_name}") 
    if response.status_code == 200:
        details = response.json()
        print(f"컬렉션 '{collection_name}'의 세부 정보:", details)
    else:
        print("컬렉션 세부 정보 조회 중 오류 발생:", response.text)

def view_data_from_collection():
    # 특정 컬렉션의 데이터 조회
    collection_name = input("데이터를 조회할 컬렉션 이름을 입력하세요: ")
    data_id = input("조회할 데이터의 ID를 입력하세요: ")
    response = requests.get(f"http://localhost:6333/collections/{collection_name}/points/{data_id}")  # 데이터 조회 엔드포인트
    if response.status_code == 200:
        data_details = response.json()
        print(f"컬렉션 '{collection_name}'의 데이터 ID '{data_id}'의 세부 정보:", data_details)
    else:
        print("데이터 조회 중 오류 발생:", response.text)

def view_data_ids_from_collection():
    # 특정 컬렉션의 데이터 ID 조회
    collection_name = input("데이터 ID를 조회할 컬렉션 이름을 입력하세요: ")
    response = requests.get(f"http://localhost:6333/collections/{collection_name}/points")  # 데이터 ID 조회 엔드포인트
    if response.status_code == 200:
        data_response = response.json()
        if 'result' in data_response and 'points' in data_response['result']:
            data_ids = [data['id'] for data in data_response['result']['points']]  # 데이터 ID 추출
            if data_ids:
                print(f"컬렉션 '{collection_name}'의 데이터 ID 목록:")
                for data_id in data_ids:
                    print(f"- {data_id}")
            else:
                print("해당 컬렉션에 데이터가 없습니다.")
        else:
            print("API 응답 형식이 올바르지 않습니다:", data_response)
    else:
        print(f"데이터 ID 조회 중 오류 발생: {response.status_code} - {response.text}")
        print("서버 응답:", response.content) 

def manage_collections():
    while True:
        print("\n관리 툴 메뉴:")
        print("1. 컬렉션 생성")
        print("2. 컬렉션 삭제")
        print("3. 컬렉션 조회")
        print("4. 컬렉션 세부 정보 조회")
        print("5. 컬렉션에 데이터 추가")
        print("6. 컬렉션에서 데이터 삭제")
        print("7. 컬렉션에서 데이터 조회")
        print("8. 컬렉션에서 데이터 ID 조회")
        print("9. 종료")
        choice = input("선택 (1-8): ")
        if choice == '1':
            create_collection()
        elif choice == '2':
            delete_collection()
        elif choice == '3':
            view_collections()
        elif choice == '4':
            view_collection_details()
        elif choice == '5':
            add_data_to_collection()
        elif choice == '6':
            delete_data_from_collection()
        elif choice == '7':
            view_data_from_collection()
        elif choice == '8':
            view_data_ids_from_collection()
        elif choice == '9':
            print("프로그램을 종료합니다.")
            break
        else:
            print("잘못된 선택입니다. 다시 시도하세요.")

def main():
    manage_collections()
    
if __name__ == "__main__":
    main()