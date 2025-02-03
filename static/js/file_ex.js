let isEditing = false;
    $(document).ready(function() {
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
                data: function (d) {
                    return $.extend({}, d, {
                        search: {
                            value: d.search.value,
                            regex: false
                        },
                        order: [[0, 'desc']],
                    });
                },
                error: function (xhr, error, thrown) {
                    console.error("AJAX Error: ", error);
                    alert("Failed to load data: " + error); 
                }
            },
            columns: [
                { data: 'doc_id', title: 'ID' },
                { data: 'file_name', title: 'File Name', render: function(data) { return limitText(data, 25); } },
                { data: 'summary', title: 'Summary', render: function(data) { return limitText(data, 50); } }
            ],
            pageLength: 35, 
            order: [[0, 'desc']], 
            initComplete: function() {
                $('#fileTable').css('font-size', '11px'); 
            },
        });
    
        $('#fileTable tbody').on('click', 'tr', function () {
            refresh_rows();

            const data = fileTable.row(this).data();
            console.log(data);
            $('#modalFileName').text(data.file_name);
            $('#fileID').text(data.doc_id);
            $('#modalFileLocation').attr('href', data.location).text(data.location);  
            $('#companyName').val(data.company);
            $('#companycode').text(data.company_code);

            if (data.summary) $('#modalSummary').html(data.summary.replace(/\n/g, '<br>'));
            if (data.comments) $('#modalComment').html(data.comments.replace(/\n/g, '<br>'));
            if (Array.isArray(data.tags)) {
                $('#modalTags').text(data.tags.join(', '));
            } else if (typeof data.tags === 'string' && data.tags.trim() !== '') {
                $('#modalTags').text(data.tags);
            }

            $('#fileDetailModal').modal('show');
        });

        $('#modalSummary').on('click', function() { editField('modalSummary', 'summary', true); });
        $('#modalTags').on('click', function() { editField('modalTags', 'tags',false); });
        $('#modalComment').on('click', function() { editField('modalComment', 'comments', true); });
        $('#searchCompany_btn').on('click', function() {

            var companyName = $('#companyName').val();
    
            // 입력값이 비어있는지 확인
            if (!companyName) {
                alert("Please enter a company name.");
                return;
            }
    
            // AJAX 요청 보내기
            $.ajax({
                url: '/searchCompany',  
                method: 'POST',         
                contentType: 'application/json', 
                data: JSON.stringify({ companyName: companyName }), 
                success: function(response) {
                    // 서버로부터 응답을 성공적으로 받은 경우
                    console.log("Response: ", response); 
                    displayResults(response);
                    $("#companyModal").modal('show');
                },
                error: function(xhr, status, error) {
                    // 에러가 발생한 경우
                    const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : "An error occurred: " + error;
                    alert("Error: " + errorMessage);
                }
            });
        });

        $('#aiSummary_btn').on('click', function() {
            const fileLoc = $("#modalFileLocation").text();
            $('#spinner').show();
            $.ajax({
                url: '/aisummary',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({
                    fileLocation: fileLoc,
                }),
                success: function(response) {
                    alert(response.success); 
                    let aiSummary = response.summary;
                    $('#modalSummary').append('<br><br> #### AI Summary #### <br><br>');
                    $('#modalSummary').append(aiSummary.replace(/\n/g, '<br>'));

                },
                error: function(xhr, status, error) {
                    const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : "An error occurred: " + error;
                    alert("Error updating file: " + errorMessage);
                },
                complete: function() {
                    // 요청 완료 시 스피너 숨김
                    $('#spinner').hide();
                }
            });
        });
        

        $('#saveChanges_btn').on('click', function() {
            const id = $('#fileID').text();
            let summary;
            if ($('#modalSummary').text().trim() !== "***") {
                summary = $('#modalSummary').html();
            } else {
                summary = '';
            }

            let tags;
            if ($('#modalTags').text().trim() !== '***') {
                tags = $('#modalTags').text();
            } else {
                tags = '';
            }
            
            let comments;
            if ($('#modalComment').text().trim() !== '***') {
                comments = $('#modalComment').html();
            } else {
                comments = '';
            }

            let companyName = $('#companyName').val();
            let companyCode = $('#companycode').text();

            const payload = JSON.stringify({
                summary: summary,
                tags: tags,
                comments: comments,
                company: companyName,
                company_code: companyCode,
            });

            console.log(payload);

            $.ajax({
                url: '/edit/file/' + id,
                method: 'PUT',
                contentType: 'application/json',
                data: payload,
                success: function(response) {
                    alert(response.success); 
                    fileTable.ajax.reload(null, false); 
                },
                error: function(xhr, status, error) {
                    const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : "An error occurred: " + error;
                    alert("Error updating file: " + errorMessage);
                }
            });

            $('#fileDetailModal').modal('hide');
        });

        $('#remove_btn').on('click', function() {
            const docId = $('#fileID').text();

            if (!confirm("Are you sure you want to delete this file?")) {
                return; 
            }
          
            $.ajax({
                url: `/delete?doc_id=${docId}`, 
                method: 'DELETE',
                success: function(response) {
                    alert("File deleted successfully.");
                    // 파일 목록을 새로 고침 (여기서 fileTable은 이미 정의된 DataTable)
                    fileTable.ajax.reload(null, false); 
                },
                error: function(xhr, status, error) {
                    const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : "An error occurred: " + error;
                    alert("Error deleting file: " + errorMessage);
                }
            });
          
            // Close modal
            $('#fileDetailModal').modal('hide');
        });
    
        $('#fileUpload_btn').click(function() {
            $('#fileInput').click(); 
        });
        
        $('#downloadFile_btn').click(async function() {
            let last_filename = $('#modalFileLocation').text().split('\\').pop().split('/').pop();
            await downloadFile(last_filename);
        });
    
        $('#fileInput').change(function() {
            const files = this.files;
            if (files.length > 0) {
                if (files[0].size > 10485760) { 
                    alert("File size exceeds 10MB. Please upload a smaller file.");
                    return;
                }
    
                const formData = new FormData();
                formData.append('file', files[0]);
                $.ajax({
                    url: `/upload`, 
                    method: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function(response) {
                        alert('File uploaded successfully.');
                        fileTable.ajax.reload(null, false); 
                    },
                    error: function(xhr, error, thrown) {
                        const errorMessage = xhr.responseJSON ? xhr.responseJSON.error : "An error occurred: " + thrown;
                        alert("Error uploading file: " + errorMessage);
                    }
                });
            }
            $(this).val('');
        });
    });
    
    function displayResults(results) {
        const $searchResults = $('#searchresults');
        $searchResults.empty();
    
        if (results.length === 0) {
            const $noResultsItem = $('<li>No results found. Click here to make new data.</li>');
            $noResultsItem.on('click', async function() {
                await create_new_comp();  
            });
            $searchResults.append($noResultsItem);
        } else {
            results.forEach(result => {
                const $li = $(`<li>${result.company} (${result.id})</li>`);
                $li.on('click', function() {
                    handleCompanyClick(result.company, result.id);
                });
                $searchResults.append($li);
            });
        }
    }
    
    async function create_new_comp() {
        const companyName = $("#companyName").val();  
    
        if (!companyName) {
            console.error('Company name is required');
            return;
        }
    
        try {
            const response = await $.ajax({
                url: '/createcompany',
                type: 'POST',
                data: JSON.stringify({ companyName: companyName }), 
                contentType: 'application/json', 
                dataType: 'json'
            });

            if (response && response.id && response.company) {
                displayResults([{ id: response.id, company: response.company }]);
            } else {
                console.error('Invalid response format:', response);
            }
        } catch (error) {
            console.error('AJAX error:', error);
        }
    }

    function handleCompanyClick(companyName, company_code) {
        $("#companyModal").modal('hide');
        $('#companyName').val(companyName);
        $('#companycode').text(company_code);
    }

    function refresh_rows() {
        $('#modalFileName').text('');
        $('#fileID').text('');
        $('#modalFileLocation').attr('href', '').text('');  
        $('#modalSummary').text('***');
        $('#modalComment').text('***');
        $('#modalTags').text('***');
        $("#companyName").val('');
        $('#companycode').text('');
    }
    
