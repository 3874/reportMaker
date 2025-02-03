$(document).ready(function() {
    // DataTable 초기화
    const companyTable = $('#companyTable').DataTable({
        responsive: true,
        lengthChange: false,
        info: false,
        scrollY: true,
        paging: true,
        order: [[0, 'asc']],
        columns: [
            { data: 'compId', title: 'ID', visible: false }, // ID는 숨김
            { data: 'company', title: 'Name', render: function(data) { return limitText(data, 30); } },
            { data: 'industry', title: 'Industry', render: function(data) { return limitText(data, 30); } },
            { data: 'summary', title: 'Summary', render: function(data) { return limitText(data, 50); } }
        ],
        pageLength: 25,
        initComplete: function() {
            $('#companyTable').css('font-size', '11px'); 
        },
        ajax: {
            url: '/companies', // 서버에서 데이터를 가져올 URL
            type: 'GET',
            dataSrc: 'data', // 서버 응답에서 데이터가 포함된 경로
            data: function(d) {
                // 추가적인 데이터 전송 (예: 검색어)
                d.search = $('#companyTable_filter input').val(); // 검색어 추가
            }
        }
    });

    // Add_btn 클릭 시 모달 초기화 및 띄우기
    $(document).on('click', '#Add_btn', function() {
        let companyName = prompt('회사명을 넣어주세요');
        let EngcompanyName = prompt('Company name in English');
        // 모달 내용 초기화
        $('#modalCompanyName').text(companyName); // 회사 이름 초기화
        $('#modalEngCompany').text(EngcompanyName);
        $('#compID').text(''); // 파일 ID 초기화
        $('#modalSummary').val(''); // 요약 초기화
        $('#modalTags').val(''); // 태그 초기화
        $('#modalComment').val(''); // 댓글 초기화
        $('#modalIndustry').val(''); // 산업 초기화
        $('#modalCountry').val(''); // 국가 초기화

        // 모달 띄우기
        $('#compDetailModal').modal('show');

        // 회사 이름 입력 textarea에 포커스 주기
        $('#modalCompanyName').focus();
    });

    // DataTable의 행 클릭 시 compDetailModal 띄우기
    $('#companyTable tbody').on('click', 'tr', function() {
        const data = companyTable.row(this).data(); // 클릭한 행의 데이터 가져오기
        if (data) {
            // 모달에 데이터 설정
            $('#modalCompanyName').text(data.company); // 회사 이름 설정
            $('#modalEngCompany').text(data.en_company);
            $('#modalSummary').val(data.summary); // 요약 설정
            $('#modalTags').val(data.tags); // 태그 설정
            $('#modalComment').val(data.comments); // 댓글 설정
            $('#compID').text(data.compId); // 파일 ID 설정

            // 모달 띄우기
            $('#compDetailModal').modal('show');
        }
    });

    // Save 버튼 클릭 시 데이터 저장 및 DataTable 업데이트
    $(document).on('click', '#saveButton', async function() {
        const companyName = $('#modalCompanyName').text(); // 회사 이름 가져오기
        const Engcompany = $('#modalEngCompany').text();
        const industry = $('#modalIndustry').val(); // 산업 가져오기
        const country = $('#modalCountry').val(); // 국가 가져오기
        const summary = $('#modalSummary').val(); // 요약 가져오기
        const tags = $('#modalTags').val(); // 태그 가져오기
        const comment = $('#modalComment').val(); // 댓글 가져오기

        // 입력값이 비어있는지 확인
        if (!companyName) {
            alert('회사 이름을 입력해 주세요.');
            return;
        }

        try {
            const response = await $.ajax({
                url: `/newCompany`, // 회사 추가를 위한 URL
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    company: companyName,
                    en_company: Engcompany,
                    industry: industry,
                    country: country,
                    summary: summary,
                    tags: tags,
                    comments: comment
                }),
            });

            console.log('모든 정보가 성공적으로 저장되었습니다.');
            $('#compDetailModal').modal('hide'); // 모달 닫기
            companyTable.row.add(response.data).draw(); // DataTable에 새 데이터 추가
        } catch (error) {
            console.error('서버에 저장 중 오류 발생:', error);
            alert('서버에 저장 중 오류가 발생했습니다.');
        }
    });

    // Remove 버튼 클릭 시 데이터 삭제
    $(document).on('click', '#removeButton', async function() {
        const compID = $('#compID').text(); // 선택된 회사의 ID 가져오기

        if (!compID) {
            alert('삭제할 회사를 선택해 주세요.');
            return;
        }

        const confirmDelete = confirm("회사를 정말로 삭제하시겠습니까?");
        if (confirmDelete) {
            try {
                await $.ajax({
                    url: `/removeCompany/${compID}`, // 회사 삭제를 위한 URL
                    method: 'DELETE',
                    success: function(response) {
                        console.log('회사가 성공적으로 삭제되었습니다.');
                        $('#compDetailModal').modal('hide');
                        // DataTable에서 행 삭제
                        companyTable.rows().every(function() {
                            const data = this.data();
                            if (data.compId === compID) { // compId가 일치하는 행 찾기
                                this.remove(); // 해당 행 삭제
                            }
                        });
                        companyTable.draw();
                        
                    },
                    error: function(xhr) {
                        const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : '알 수 없는 오류 발생';
                        alert(`Error: ${errorMessage}`);
                    }
                });
            } catch (error) {
                console.error('서버에서 삭제 중 오류 발생:', error);
                alert('서버에서 삭제 중 오류가 발생했습니다.');
            }
        }
    });
});

// 텍스트 길이 제한 함수
function limitText(text, limit) {
    if (text == null) return "..."; // null과 undefined 체크
    if (Array.isArray(text)) {
        text = text.join(', ').trim(); // 배열을 String으로 변환
    }
    if (typeof text !== "string") return "..."; // 문자열이 아닌 경우

    return text.length > limit ? text.substring(0, limit) + '...' : text; // 제한 출력
}