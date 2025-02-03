async function fetchFromOpenAI(AImodel, payload) {
    const apiKey = 'YOUR_OPENAI_API_KEY';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: AImodel, // gpt-4o-mini
            messages: [{ role: 'user', content: payload }],
            temperature: 0.7
        })
    });

    if (!response.ok) {
        const errorDetails = await response.json();
        console.error('Error:', errorDetails);
        return;
    }

    const result = await response.json();
    console.log('Response:', result);
    alert(`Response: ${result.choices[0].message.content}`);
}

function limitText(text, limit) {
    if (text == null) return "...";
    if (Array.isArray(text)) {
        text = text.join(', ').trim(); 
    }
    if (typeof text !== "string") return "..."; 

    return text.length > limit ? text.substring(0, limit) + '...' : text;
}

async function downloadFile(fileName) {
    $.ajax({
        url: '/download/' + encodeURIComponent(fileName),
        method: 'GET',
        xhrFields: {
            responseType: 'blob' 
        },
        success: function(data) {
            var downloadUrl = window.URL.createObjectURL(data);
            var a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileName; 
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a); 
        },
        error: function(xhr, status, error) {
            alert('파일 다운로드 실패: ' + error);
        }
    });
}

function editField(fieldId, isTextarea) {
    if (isEditing) return;
    isEditing = true;

    let originalText = $('#' + fieldId).html().replace(/<br\s*\/?>/gi, '\n');

    if (originalText.trim() === '***') originalText = '';

    let inputField;
    
    if (isTextarea) {
        inputField = $('<textarea class="form-control" rows="15" style="font-size: 10px;">' + originalText + '</textarea>');
    } else {
        inputField = $('<input type="text" class="form-control" value="' + originalText + '" style="font-size: 10px;" />');
    }

    $('#' + fieldId).empty().append(inputField);

    inputField.focus();

    inputField.on('blur', function() {
        let updatedText = $(this).val();
        if (updatedText.trim() === '') {
            $('#' + fieldId).html('***');
        } else {
            $('#' + fieldId).html(updatedText.replace(/\n/g, '<br>'));
        }
        isEditing = false;
    });

    inputField.on('keypress', function(event) {
        if (event.which === 13) { 
            event.preventDefault();

            const currentValue = $(this).val();
            $(this).val(currentValue + '\n'); 
        }
    });
}


    // 절대 지우지 말것 (PDF --> Text --> LLM --> result)
    // $('#fileInput').change(async function() {
    //     pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    //     const file = this.files[0]; // 선택한 파일 가져오기
    
    //     // 파일이 선택되지 않았을 경우
    //     if (!file) {
    //         return;
    //     }
    
    //     // 파일 확장자 확인
    //     const fileExtension = file.name.split('.').pop().toLowerCase();
    //     if (fileExtension !== 'pdf') {
    //         alert('PDF 파일만 지원합니다.');
    //         $(this).val(''); // 파일 입력 초기화
    //         return;
    //     }
    
    //     // PDF 파일인 경우 텍스트 추출
    //     const reader = new FileReader();
    //     reader.onload = async function(event) {
    //         const typedarray = new Uint8Array(event.target.result);
    
    //         try {
    //             // pdf.js를 사용하여 PDF에서 텍스트 추출
    //             const pdf = await pdfjsLib.getDocument(typedarray).promise;
    //             let textContent = '';
    
    //             // 모든 페이지에서 텍스트 추출
    //             const numPages = pdf.numPages;
    //             const pagePromises = [];
    
    //             for (let i = 1; i <= numPages; i++) {
    //                 pagePromises.push(pdf.getPage(i).then(async function(page) {
    //                     const text = await page.getTextContent();
    //                     text.items.forEach(function(item) {
    //                         textContent += item.str + ' '; // 텍스트 추가
    //                     });
    //                 }));
    //             }
    
    //             // 모든 페이지의 텍스트 추출이 완료된 후
    //             await Promise.all(pagePromises);
    //             console.log('추출된 텍스트:', textContent);
    //             const messageId = Date.now();
    //             $('#resultsContent').append(`
    //                 <div class="chatmessage col-start-1 col-end-8 p-3 rounded-lg" data-id="${messageId}">
    //                   <div class="flex flex-row items-center">
    //                     <div
    //                       class="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-500 flex-shrink-0"
    //                     >
    //                       Me
    //                     </div>
    //                     <div
    //                       class="relative ml-3 text-sm bg-white py-2 px-4 shadow rounded-xl"
    //                     >
    //                       <div>Summarizing this: "${file.name}"</div>
    //                     </div>
    //                   </div>
    //                 </div>`);
    //             $('#resultsContent').append(`
    //                 <div id="loadingSpinner" class="col-start-1 col-end-8 p-3 rounded-lg">
    //                     <div class="spinner-border text-primary" role="status">
    //                         <span class="sr-only">Loading...</span>
    //                     </div>
    //                 </div>
    //             `);
    //             // AI에게 요청
    //             let aiprompt = 'The following text may have awkward formatting, duplicating content, or lack clear organization. Please process the text to the make it easier to understand by summarizing the key points, simplifying complex sentences, removing unnecessary duplication and improving the logical flow and organizing paragraphs coherently. Here is the text: ';
    //             let query = aiprompt + textContent;
    //             let aiReply = await sendMessageToAI(query, projectId, messageId);
    //             console.log('reply:', aiReply);
    //             const md = window.markdownit();
    //             const htmlContent = md.render(aiReply);

    //             $('#loadingSpinner').remove();
    //             $('#resultsContent').append(`<div class="chatmessage col-start-6 col-end-13 p-3 rounded-lg" data-id="${messageId}">
    //                 <div class="flex items-center justify-start flex-row-reverse">
    //                 <div
    //                     class="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-200 flex-shrink-0"
    //                 >
    //                     AI
    //                 </div>
    //                 <div
    //                     class="relative mr-3 text-sm bg-indigo-100 py-2 px-4 shadow rounded-xl"
    //                 >
    //                     <div>${htmlContent}</div>
    //                 </div>
    //                 </div>
    //                 <span class="ml-2 text-red-500 cursor-pointer remove-chat" aria-label="Remove chat">x</span>
    //             </div>
    //             `);
    //             const contents1 = $('#resultsContent').html();
    //             updateProjectData({ contents: encodeURIComponent(contents1) });
    //         } catch (error) {
    //             console.error('PDF 처리 중 오류 발생:', error);
    //         }
    //     };
    
    //     reader.readAsArrayBuffer(file); // 파일을 ArrayBuffer로 읽기
    // });
    