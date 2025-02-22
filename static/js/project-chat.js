$(document).ready(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');
    const MaxNoFiles = 10;
    let webMode = 'no';
    let relatedFiles, promptsJSON;
    const fileTable = $('#fileTable').DataTable({
        responsive: true,
        processing: true,
        serverSide: true,
        lengthChange: false,
        info: false,
        scrollY: true,
        ajax: {
            url: `/files`,
            method: 'GET',
            timeout: 10000,
            data: function (d) {
                return $.extend({}, d, {
                    search: {
                        value: d.search.value,
                        regex: false
                    },
                    order: [[0, 'desc']],
                    length: 20
                });
            },
            error: function (xhr, error, thrown) {
                console.error("AJAX Error: ", error);
                alert("Failed to load data: " + error); // 사용자에게 오류 알림 추가

            }
        },
        columns: [
            { data: 'fileId', title: 'File ID', visible: false },  // 'fileId' 필드로 변경
            { data: 'file_name', title: 'File Name', width: '30%', render: function(data) { return limitText(data, 30); } },
            { data: 'summary', title: 'Summary', width: '70%', render: function(data) { return limitText(data, 50); } }, // 'comments' 필드 추가
        ],
        pageLength: 25, 
        order: [[0, 'asc']], 
        initComplete: function() {
            $('#fileTable').css('font-size', '10px'); 
            this.api().columns.adjust();
        },
    });

    if (!projectId) {
        alert('프로젝트를 시작할 수 없습니다. projectId가 필요합니다.');
        $('#searchButton').prop('disabled', true); // searchButton 비활성화
    } else {
      $.ajax({
            url: `/findProject/${projectId}`,
            method: 'GET',
            success: function(response) {
                if (response && response.data) { 
                    const title = response.data.title || 'No Title';
                    const summary = response.data.summary || 'No Summary'; 
                    relatedFiles = response.data.related_files;
                    $('#title').text(decodeURIComponent(title));
                    $('#projectId').text(response.data.projectId);
                    $('#summary').text(decodeURIComponent(summary));
                    const createAt = formatDate(response.data.createAt);
                    const updateAt = formatDate(response.data.updateAt);
                    $('#createAt').text(createAt);
                    $('#updateAt').text(updateAt);
                    $('#resultsContent').html(decodeURIComponent(response.data.contents));
                    fetchRelatedFiles(relatedFiles);
    
                } else {
                    alert("유효하지 않은 응답입니다.");
                }

            },
            error: function(xhr) {
                // 프로젝트가 없을 경우 경고 메시지 표시
                alert('프로젝트를 찾을 수 없습니다.');
                $('#searchButton').prop('disabled', true); // searchButton 비활성화
            }
        });
    }

    $('#fileTable tbody').on('click', 'tr', function () {
        const data = fileTable.row(this).data();
        if (!relatedFiles.includes(data.fileId)) { // fileId가 이미 존재하지 않는 경우
            relatedFiles.push(data.fileId);
            updateProjectData({ related_files: relatedFiles });
            fetchRelatedFiles(relatedFiles);
        } else {
            alert('이미 참고중입니다.');
        }
        $('#fileSelectModal').modal('hide');
    });

    $('#websearchBtn').click(function () {
        const icon = $('#websearchIcon');
        if (icon.text() === '🌐') {
            icon.text('🌍'); 
            webMode = 'yes';
        } else {
            icon.text('🌐'); 
            webMode = 'no';
        }
    });

    $('#searchButton').click(async function() {
        const query = $('#searchQuery').val();
        const messageId = Date.now();
        const SearchEngine = 'yahoo';
        $('#searchQuery').val('');

        if (webMode === 'no') {
            appendChatMe(messageId, query);
            let response1 = await sendMessageToAI(query, projectId);
    
            if (response1) {
                $('#loadingSpinner').remove(); 
                const md = window.markdownit();
                const html_code = md.render(response1);
                appendChatAI(messageId, html_code);
    
                const contents = $('#resultsContent').html();
                try {
                    updateProjectData({ contents: encodeURIComponent(contents) });
                } catch (error) {
                    console.error('프로젝트 데이터 업데이트 중 오류 발생:', error);
                }
            } else {
                $('#resultsContent').append(`<div>응답이 없습니다.</div>`);
            }
        } else {
            appendChatMe(messageId, `[${SearchEngine}] ${query}`);
            let KKurl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
            let KKresp = await extractContent(KKurl);
            $('#loadingSpinner').remove();
            let ArrResp = await parseSearchResults(KKresp, SearchEngine);
            let resultItem = '';
            ArrResp.forEach(result => {
                resultItem += `
                    <div class="result-item">
                        <h5><a href="${result.link}" target="_blank">${result.title}</a></h5>
                        <p>${result.snippet}</p>
                        <button class="text-extract-btn text-white bg-purple-500 rounded p-1 text-sm mt-4"" >Text Extract</button>
                    </div>
                    <hr>
                `; // 결과를 컨테이너에 추가
            });
            appendChatAI(messageId, resultItem);
            const Kcontents = $('#resultsContent').html();
            try {
                updateProjectData({ contents: encodeURIComponent(Kcontents) });
            } catch (error) {
                console.error('프로젝트 데이터 업데이트 중 오류 발생:', error);
            }

        }
    });

    $('#searchQuery').keypress(function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // 기본 Enter 동작 방지
            $('#searchButton').click(); // 검색 버튼 클릭 이벤트 발생
        }
    });

    $('#title').on('click', function() {
          const currentTitle = $(this).text();
          const input = $('<input>', {
              type: 'text',
              value: currentTitle,
              class: 'form-control',
              id: 'titleInput'
          });

          $(this).replaceWith(input);
          input.focus();

          // 입력 필드에서 포커스를 잃을 때 업데이트 요청
          input.on('blur', function() {
              const newTitle = $(this).val();
              updateProjectData({ title: encodeURIComponent(newTitle) }); 
              $(this).replaceWith($('<span>', { text: newTitle, id: 'title' }));
              window.location.reload();
          });

          // Enter 키를 눌렀을 때도 업데이트 요청
          input.on('keypress', function(event) {
              if (event.key === 'Enter') {
                  const newTitle = $(this).val();
                  updateProjectData({ title: encodeURIComponent(newTitle) }); 
                  $(this).replaceWith($('<span>', { text: newTitle, id: 'title' }));
                  window.location.reload();
              }
          });
    });
    
    $('#summary').on('click', function() {
        const currentSummary = $(this).text();
        const input = $('<input>', {
            type: 'text',
            value: currentSummary,
            class: 'form-control',
            id: 'summaryInput'
        });

        $(this).replaceWith(input);
        input.focus();

        // 입력 필드에서 포커스를 잃을 때 업데이트 요청
        input.on('blur', function() {
            const newSummary = $(this).val();
            updateProjectData({ summary: encodeURIComponent(newSummary) }); // 요약 업데이트
            $(this).replaceWith($('<span>', { text: newSummary, id: 'summary' }));
            window.location.reload();
        });

        // Enter 키를 눌렀을 때도 업데이트 요청
        input.on('keypress', function(event) {
            if (event.key === 'Enter') {
                const newSummary = $(this).val();
                updateProjectData({ summary: encodeURIComponent(newSummary) }); // 요약 업데이트
                $(this).replaceWith($('<span>', { text: newSummary, id: 'summary' }));
                window.location.reload();
            }
        });
    });

    $('#removeChatButton').click(function() {
        const confirmDelete = confirm("채팅 내용을 정말로 지우시겠습니까?"); // 확인 메시지
        if (confirmDelete) {
            // contents를 비우기 위한 업데이트 요청
            updateProjectData({ contents: '' }); // contents를 빈 문자열로 업데이트
  
            // 화면에서도 지우기
            $('#resultsContent').html(''); // #resultsContent의 내용을 지웁니다.
          }
    });

    $('#removeProjectButton').click(function() {
        const confirmDelete = confirm("프로젝트를 정말로 지우시겠습니까?"); // 확인 메시지
        if (confirmDelete) {
            // 프로젝트 삭제를 위한 AJAX 요청
            $.ajax({
                url: `/removeProject/${projectId}`, // 프로젝트 삭제 엔드포인트
                method: 'DELETE',
                success: function(response) {
                    alert('프로젝트가 성공적으로 삭제되었습니다.');
                    // 프로젝트 삭제 후 필요한 추가 작업 (예: 페이지 리다이렉트)
                    window.location.href = '/projectlist'; // 프로젝트 목록 페이지로 리다이렉트
                },
                error: function(xhr) {
                    alert('프로젝트 삭제에 실패했습니다.');
                }
            });
        }
    });

    $('#FromPCButton').click(function() {
        $('#fileSelectModal').modal('hide');
        $('#fileInput').click();

    });

    $('#showPrompt').click(async function() {
        promptsJSON = await fetchPrompts();
        console.log(promptsJSON);
        $('#myPrompts').empty();
        
        if (promptsJSON) {
            console.log(promptsJSON);
            
            // 모달 내용 초기화
            $('#promptEditContainer').empty();

            // promptsJSON의 각 항목을 반복하여 입력 필드 추가
            for (const [key, value] of Object.entries(promptsJSON)) {
                const inputField = $(`
                        <div class="form-group">
                        <label><small>${key}</small></label>
                        <button type="button" class="btn btn-danger btn-sm remove-prompt" data-prompt-key="${key}"><small>Delete</small></button>
                        <div>
                            <textarea class="form-control" data-prompt-key="${key}" style="width: 450px; height: 100px; font-size: 12px;">${value}</textarea>
                        </div></div>`);
                $('#promptEditContainer').append(inputField);
            }

            // 모달 띄우기
            $('#editPromptModal').modal('show');
        } else {
            console.error('유효하지 않은 promptsJSON:', promptsJSON);
            alert('프롬프트를 가져오는 데 실패했습니다.');
        }
    });

    $('#addPrompt').click(function() {
        const newKey = $('#newPromptKey').val().trim();
        const newValue = $('#newPromptValue').val().trim();
    
        if (newKey && newValue) {
            const inputField = $(`
                <div class="form-group">
                <label><small>${newKey}</small></label>
                <button type="button" class="btn btn-danger btn-sm remove-prompt" data-prompt-key="${newKey}"><small>Delete</small></button>
                <div>
                    <textarea class="form-control" data-prompt-key="${newKey}" style="width: 450px; height: 100px; font-size: 12px;">${newValue}</textarea>
                </div></div>`);
            $('#promptEditContainer').append(inputField);
            promptsJSON[newKey] = newValue;
            console.log(promptsJSON);
            $('#newPromptKey').val('');
            $('#newPromptValue').val(''); 
        } else {
            alert('Input Prompt Key and Value.');
        }
    });

    $('#savePrompts').click(function() {
        const updatedPrompts = {};
        $('#promptEditContainer textarea').each(function() {
            const key = $(this).data('prompt-key');
            const value = $(this).val();
            updatedPrompts[key] = value;
        });
        promptsJSON = updatedPrompts;
        upldatePrompts(promptsJSON);
    });

    $('#makeReport').click(async function() {
        promptsJSON = await fetchPrompts();
        if (!promptsJSON || typeof promptsJSON !== 'object') {
            alert('프롬프트 데이터가 유효하지 않습니다.');
            return;
        }
    
        // promptsJSON에서 키를 가져와서 버튼 형태로 추가
        const keys = Object.keys(promptsJSON);
        if (keys.length === 0) {
            alert('프롬프트가 없습니다.');
            return;
        }
    
        // 모달 내용 초기화
        $('#promptButtonContainer').empty();
// 색상 배열 정의
        const colors = ['btn-primary', 'btn-secondary', 'btn-success', 'btn-danger', 'btn-warning', 'btn-info', 'btn-light', 'btn-dark'];

        keys.forEach(key => {
            // 랜덤 색상 선택
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const button = $(`
                <button type="button" class="btn ${randomColor} m-1 select-prompt-button w-full" data-key="${key}">
                    ${key}
                </button><br>
            `);
            $('#promptButtonContainer').append(button);
        });
    
        $('#selectPromptModal').modal('show');
    });


    $('#filefindButton').click(function() {
        if (relatedFiles.length > MaxNoFiles) {
            alert("더 이상 파일을 첨부할 수 없습니다. 최대 10개의 파일만 첨부 가능합니다.");
            return; // 파일 첨부를 중단
        }
        $('#fileSelectModal').modal('show');
    });

    $('#fileInput').change(function() {
        const files = this.files;
        if (files.length > 0) {
            if (files[0].size > 52428800) { 
                alert("File size exceeds 50MB. Please upload a smaller file.");
                return;
            }
            const formData = new FormData();
            formData.append('file', files[0]);
            // formData.append('sessionId', projectId);
            // formData.append('fileName', files[0].name); 
            $.ajax({
                url: `/uploadFile`, 
                method: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: async function(response) {
                    alert('File uploaded successfull and this will be added this to the related files');
                    let UfileId = response.data.fileId;
                    if (!relatedFiles.includes(UfileId)) {
                        relatedFiles.push(UfileId);
                        updateProjectData({ related_files: relatedFiles });
                        fetchRelatedFiles(relatedFiles);
                    } else {
                        alert('이미 참고중입니다.');
                    }
                    fileTable.ajax.reload(); 
                },
                error: function(xhr, error, thrown) {
                    const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : "An error occurred: " + thrown;
                    alert("Error uploading file: " + errorMessage);
                }
            });
        }
        $(this).val('');
    });

    $(document).on('click', '.text-extract-btn', async function() {
        let messageId = Date.now();
        const linkElement = $(this).siblings('h5').find('a');
        const LLurl = linkElement.attr('href');
        const title = linkElement.text();

        appendChatMe(messageId, `Summary of "${title}"`);
        const targetUrl = extractTargetUrl(LLurl);    
        let extContent = await extractContent(targetUrl);
        console.log(extContent);
        let finalText = extractTextFromHTML(extContent);
        finalText = finalText.replace(/\n/g, '');
        let query = `Summarize this text: ${finalText}`;
        let LLresp = await sendMessageToAI(query, projectId);
        if (LLresp) {
            $('#loadingSpinner').remove(); 
            let md = window.markdownit();
            let html_code = md.render(LLresp);
            appendChatAI(messageId, html_code);

            let Mcontents = $('#resultsContent').html();
            try {
                updateProjectData({ contents: encodeURIComponent(Mcontents) });
            } catch (error) {
                console.error('프로젝트 데이터 업데이트 중 오류 발생:', error);
            }
        } else {
            $('#resultsContent').append(`<div>응답이 없습니다.</div>`);
        }

    });

    $(document).on('click', '.select-prompt-button', async function() {
        const selectedKey = $(this).data('key');
        const prompt = promptsJSON[selectedKey];
        const contents = $('#resultsContent').html(); 
        $('#selectPromptModal').modal('hide');
    
        $('#loadingOverlay').show();
    
        console.log(prompt);
        const query = `${prompt} ${contents}`;
        const aiResponse = await sendMessageToAI(query, projectId);
    
        if (aiResponse) {
            $('#loadingOverlay').hide(); // 로딩 스피너 제거
    
            // 요약된 내용을 로컬 스토리지에 저장
            localStorage.setItem('summaryContent', aiResponse);
    
            window.open('/ffeditor', '_blank');
        } else {
            $('#resultsContent').append(`<div>응답이 없습니다.</div>`);
        }
    
    });

    $(document).on('click', '.remove-file', function() {
        const confirmDelete = confirm("파일을 프로젝트에서 정말로 삭제하시겠습니까?");
        if (confirmDelete) {
            let fileId = $(this).closest('.flex').find('button').data('file-id');
            $(this).closest('.flex').remove(); 
            relatedFiles = relatedFiles.filter(id => id !== fileId);
            updateProjectData({ related_files: relatedFiles });
            alert("파일을 삭제한 후에는 반드시 File Bank 오른쪽의 리로드 버튼을 눌러주세요.");
        } 

    });

    $(document).on('click', '.analyze-file', async function() {
        const confirmAnalyze = confirm("Really do you want to summarize this file?");
        if (!confirmAnalyze) return;

        const fileId = $(this).siblings('button').data('file-id');
        const fileName = $(this).siblings('button').data('file-name');
    
            // PDF.js를 사용하여 PDF에서 텍스트 추출
        try {
            const response = await $.ajax({
                url: `/downloadFile/${fileId}`, // URL에 fileId 포함
                method: 'GET',
                xhrFields: {
                    responseType: 'blob' // 응답을 Blob 형식으로 받기
                }
            });

            const file = new File([response], fileName); // Blob을 File 객체로 변환
            const reader = new FileReader();
            reader.onload = async function(event) {
                const typedarray = new Uint8Array(event.target.result);

                try {
                    // pdf.js를 사용하여 PDF에서 텍스트 추출
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let textContent = '';

                    // 모든 페이지에서 텍스트 추출
                    const numPages = pdf.numPages;
                    const pagePromises = [];

                    for (let i = 1; i <= numPages; i++) {
                        pagePromises.push(pdf.getPage(i).then(async function(page) {
                            const text = await page.getTextContent();
                            text.items.forEach(function(item) {
                                textContent += item.str + ' '; // 텍스트 추가
                            });
                        }));
                    }

                    // 모든 페이지의 텍스트 추출이 완료된 후
                    await Promise.all(pagePromises);
                    console.log('추출된 텍스트 길이:', textContent.length);

                    const maxLength = 100000; // 최대 길이 설정
                    if (textContent.length > maxLength) {
                        textContent = textContent.substring(0, maxLength) + '...'; // 잘라내고 '...' 추가
                        console.warn('텍스트가 너무 길어 일부가 잘렸습니다.');
                    }
                    
                    const messageId = Date.now();
                    appendChatMe(messageId, `Summarizing this: "${fileName}"`);
                    // AI에게 요청
                    let aiprompt = 'The following text may have awkward formatting, duplicating content, or lack clear organization. Please process the text to the make it easier to understand by summarizing the key points, simplifying complex sentences, removing unnecessary duplication and improving the logical flow and organizing paragraphs coherently in the primary language of the text. Here is the text: ';
                    let query = aiprompt + textContent;
                    let aiReply = await sendMessageToAI(query, projectId);
                    console.log('reply:', aiReply);
                    const md = window.markdownit();
                    const htmlContent = md.render(aiReply);

                    $('#loadingSpinner').remove();
                    appendChatAI(messageId, htmlContent);

                    const contents1 = $('#resultsContent').html();
                    updateProjectData({ contents: encodeURIComponent(contents1) });
                } catch (error) {
                    console.error('PDF 처리 중 오류 발생:', error);
                }
            };

            reader.readAsArrayBuffer(file); // 파일을 ArrayBuffer로 읽기
        } catch (error) {
            console.error('파일 다운로드 중 오류 발생:', error);
            alert('파일 다운로드 중 오류가 발생했습니다.');
        }
        
    });

    $(document).on('click', '.remove-chat', function() {
        const chatMessage = $(this).closest('.chatmessage');
        const messageId = chatMessage.data('id');

        // 이전 메시지를 찾기 위한 로직 추가
        const previousMessage = chatMessage.prev('.chatmessage'); // 이전 메시지 찾기

        // 두 메시지를 함께 삭제
        chatMessage.remove(); 
        previousMessage.remove(); // 이전 메시지 삭제
        
        let htmlCode = $('#resultsContent').html();
        console.log(htmlCode);

        //update Data
        updateProjectData({ contents: encodeURIComponent(htmlCode) });
    });

    $(document).on('click', '.remove-prompt', function() {
        const promptKey = $(this).data('prompt-key');
        delete promptsJSON[promptKey];
        $(`textarea[data-prompt-key="${promptKey}"]`).closest('.form-group').remove(); // 해당 프롬프트 삭제
    });

    $(document).on('click', '.add-company', function() {
        alert(1);
    });

    $(document).on('click', '#relatedfile button', async function() {
        const confirmAnalyze = confirm("Really do you want to download this file?");
        if (!confirmAnalyze) return;

        let fileId = $(this).data('file-id'); 
        let fileName = $(this).find('small').text();

        try {
            const response = await $.ajax({
                url: `/downloadFile/${fileId}`, // URL에 fileId 포함
                method: 'GET',
                xhrFields: {
                    responseType: 'blob' // 응답을 Blob 형식으로 받기
                }
            });

            // Blob 객체를 URL로 변환
            const url = window.URL.createObjectURL(response);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName; // 다운로드할 파일 이름 설정
            document.body.appendChild(a);
            a.click(); // 다운로드 시작
            a.remove(); // 링크 요소 제거
            window.URL.revokeObjectURL(url); // URL 해제
        } catch (error) {
            console.error('파일 다운로드 중 오류 발생:', error);
            alert('파일 다운로드 중 오류가 발생했습니다.');
        }

    });
    
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  
    function updateProjectData(data) {
        $.ajax({
            url: `/updateProject/${projectId}`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(data), // data를 포함하여 요청
            success: function(response) {
                console.log('Project updated successfully:', response);
            },
            error: function(xhr) {
                alert('프로젝트 업데이트에 실패했습니다.');
            }
        });
    }

    function limitText(text, limit) {
        if (text == null) return "..."; // null과 undefined 체크
        if (Array.isArray(text)) {
            text = text.join(', ').trim(); // 배열을 String으로 변환
        }
        if (typeof text !== "string") return "..."; // 문자열이 아닌 경우

        return text.length > limit ? text.substring(0, limit) + '...' : text; // 제한 출력
    }

    function appendChatMe(messageId, query) {
        $('#resultsContent').append(`
            <div class="chatmessage col-start-1 col-end-8 p-3 rounded-lg" data-id="${messageId}">
              <div class="flex flex-row items-center">
                <div class="relative ml-3 text-sm bg-white py-2 px-4 shadow rounded-xl">
                  <div>${query}</div>
                </div>
              </div>
            </div>`);
    
            showLoadingSpinner();
    }

    function appendChatAI(messageId, html_code) {
        $('#resultsContent').append(`
            <div class="chatmessage col-start-1 col-end-13 p-3 rounded-lg" data-id="${messageId}">
              <div class="flex flex-row items-center">
                <div class="flex items-center justify-center h-10 w-10 rounded-full bg-purple-500 flex-shrink-0">
                  AI
                </div>
                <div class="relative ml-3 text-sm bg-indigo-100 py-2 px-4 shadow rounded-xl">
                  <div>${html_code}</div>
                  <span class="ml-2 text-red-500 cursor-pointer remove-chat" aria-label="Remove chat">x</span>
                </div>
              </div>
            </div>`);
    }

    function extractTextFromHTML(htmlContent) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        return doc.body.textContent || "";
    }

    function extractTargetUrl(LLurl) {
        // 'RU=' 다음에 오는 부분을 추출
        const ruIndex = LLurl.indexOf('/RU=');
        if (ruIndex === -1) {
            console.error("RU parameter not found in the URL.");
            return null;
        }
    
        // RU= 이후의 문자열을 추출
        const start = ruIndex + 4; // '/RU='의 길이
        const end = LLurl.indexOf('/RK=', start);
        const encodedTargetUrl = end !== -1 ? LLurl.substring(start, end) : LLurl.substring(start);
    
        try {
            // 디코딩하여 실제 URL 반환
            return decodeURIComponent(encodedTargetUrl);
        } catch (error) {
            console.error("Error decoding the target URL:", error);
            return null;
        }
    }

    function showLoadingSpinner() {
        $('#resultsContent').append(`
            <div id="loadingSpinner" class="col-start-6 col-end-12 p-3 rounded-lg">
                <div class="spinner-border text-primary" role="status">
                    <span class="sr-only">Loading...</span>
                </div>
            </div>
        `);
    }

    async function fetchRelatedFiles(relatedFiles) {
        $('#relatedfile').empty();
        for (const fileId of relatedFiles) {
            try {
                const fileResponse = await $.ajax({
                    url: `/findFile/${fileId}`,
                    method: 'GET'
                });
    
                if (fileResponse && fileResponse.data && fileResponse.data.file_name) {
                    const fileName = fileResponse.data.file_name;
                    var button = $(`<div class="flex items-center">
                                        <button class="flex hover:bg-gray-100" data-file-id="${fileId}" data-file-name="${fileName}">
                                            <div class="ml-2 text-sm">
                                                <small>${limitText(fileName, 30)}</small>
                                            </div>
                                        </button>
                                        <span class="text-blue-500 cursor-pointer analyze-file ml-2" aria-label="download file">📖</span>
                                        <span class="text-red-500 cursor-pointer remove-file ml-2" aria-label="Remove file"><small>❌</small></span>
                                    </div>`);
                    $('#relatedfile').append(button);
                } else {
                    console.error('파일 이름을 찾을 수 없습니다:', fileResponse);
                }
            } catch (xhr) {
                console.error('파일을 찾을 수 없습니다:', xhr);
                alert('파일을 찾을 수 없습니다.');
            }
        }
    }

    async function sendMessageToAI(query, projId) {
    
        try {
            const response = await $.ajax({

                url: '/complexSearch',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify([{
                    sessionId: projId,
                    action: 'sendMessage',
                    chatInput: query
                }])
            });
            return response;
        } catch (xhr) {
            const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : '알 수 없는 오류 발생';
            $('#resultsContent').append(`<div><strong>AI:</strong> ${errorMessage}</div>`);
        } finally {
            $('#loadingSpinner').remove(); // 로딩 스피너 제거
        }
    }

    async function fetchPrompts() {
        try {
            const response = await fetch('/getPrompts');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            return data.data;
        } catch (error) {
            console.error('Error fetching prompts:', error);
            alert('프롬프트를 가져오는 데 실패했습니다.');
        }
    }

    async function upldatePrompts(promptsJSON) {
        $.ajax({
            url: '/updatePrompts', // 업데이트 엔드포인트
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify(promptsJSON),
            success: function(response) {
                alert('프롬프트가 성공적으로 업데이트되었습니다.');
                console.log(response);
                $('#editPromptModal').modal('hide'); // 모달 닫기
            },
            error: function(xhr) {
                alert('프롬프트 업데이트에 실패했습니다.');
            }
        });
    }

    async function pdfExtract(formData){
        await $.ajax({
            url: '/addVectorDB', 
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log(response);
                $('#loadingSpinner').remove();
            },
            error: function(xhr) {
                console.error(`파일 전송 중 오류 발생:`, xhr);
            }
        });
    }

    async function extractContent(url) {
        const allOriginsUrl = 'https://api.allorigins.win/get?url=' + url;
    
        try {
            const response = await fetch(allOriginsUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36'
                }
            });
            const data = await response.json();
    
            if (data.contents) {
                return data.contents;
            } else {
                throw new Error('No contents');
            }
        } catch (error) {
            console.error('에러 발생:', error);
            return null;
        }
    }

    async function parseSearchResults(htmlContent, searchEngine) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
    
        let targetDivs;
        switch (searchEngine) {
            case 'yahoo':
                targetDivs = doc.querySelectorAll('h3.title.mt-15.mb-4[style="display:block;"]');
                break;
            case 'google':
                targetDivs = doc.querySelectorAll('div.Gx5Zad.xpd.EtOod.pkphOe');
                break;
            default:
                throw new Error('Invalid search engine specified');
        }
    
        const extractedContent = Array.from(targetDivs).map(element => {
            let link, title, snippet;
    
            switch (searchEngine) {
                case 'yahoo':
                    const linkElementYahoo = element.querySelector('a');
                    if (!linkElementYahoo) return null;
    
                    link = linkElementYahoo.getAttribute('href') || '';
                    const clonedLinkElementYahoo = linkElementYahoo.cloneNode(true);
                    const spansYahoo = clonedLinkElementYahoo.querySelectorAll('span');
                    spansYahoo.forEach(span => span.remove());
                    title = clonedLinkElementYahoo.textContent.trim();
    
                    const parentDivYahoo = element.closest('div.algo-sr');
                    const snippetElementYahoo = parentDivYahoo ? parentDivYahoo.querySelector('.compText.aAbs') : null;
                    snippet = snippetElementYahoo ? snippetElementYahoo.textContent.trim() : '';
                    break;
    
                case 'google':
                    const linkElementGoogle = element.querySelector('a');
                    if (!linkElementGoogle) return null;
    
                    const url = new URL(linkElementGoogle.href);
                    link = url.searchParams.get('q') || '';
    
                    const titleElementGoogle = element.querySelector('h3');
                    if (titleElementGoogle) {
                        title = titleElementGoogle.textContent.trim();
                        const excludedDiv = element.querySelector('div.egMi0.kCrYT');
                        if (excludedDiv) {
                            excludedDiv.remove();
                        }
                        const snippetDiv = element.querySelector('div.kCrYT');
                        snippet = snippetDiv ? snippetDiv.textContent.trim() : '';
                    }
                    break;
            }
    
            return link && title ? { link, title, snippet } : null;
        }).filter(item => item !== null);
    
        return extractedContent; 
    }
    
});

