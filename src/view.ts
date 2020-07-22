import * as vscode from "vscode";
import * as path from "path";
import { Base64Utils } from "./base64utils";

export class View {
    public createView(extensionRoot: vscode.Uri, target: string, mimeType: string, viewType: string, filePath?: string) {
        // Create and show panel
        var webviewPanel = vscode.window.createWebviewPanel("base64viewer", "Base64 Viewer", vscode.ViewColumn.Two, {});
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        if (viewType === "decoding") {
            webviewPanel.webview.html = this.initWebviewDecodingContent(extensionRoot, webviewPanel.webview, target, mimeType);
        } else if (viewType === "encoding") {
            webviewPanel.webview.html = this.initWebviewEncodingContent(extensionRoot, webviewPanel.webview, target, mimeType, filePath || "");
        }
    }

    private initWebviewDecodingContent(extensionRoot: vscode.Uri, webview: vscode.Webview, base64String: string, mimeType: string): string {
        const b64u = new Base64Utils();
        const spacer = '  -  ';
        const resolveAsUri = (...p: string[]): vscode.Uri => {
            const uri = vscode.Uri.file(path.join(extensionRoot.path, ...p));
            return webview.asWebviewUri(uri);
        };
        const fileSize = b64u.getFileSize(base64String);

        let head = ``;
        let body = ``;

        if (mimeType === "application/pdf") {
            head = `
                <!DOCTYPE html>
                <html dir="ltr" mozdisallowselectionprint>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                        <meta name="google" content="notranslate">
                        <meta http-equiv="X-UA-Compatible" content="IE=edge">
                        <title>Base 64 Viewer</title>
                        <script src="${resolveAsUri("lib", "build", "pdf.js")}"></script>
	                    <link rel="stylesheet" href="${resolveAsUri("src", "viewer.css")}">
                    </head>`;
            body = `
                <body>
                    <div class="title-bar">
                        <h1>Base 64 Viewer</h1>
                    </div>
            
                    <div class="page-content two-col">
                        <div>
                            <h3>${mimeType}  (${fileSize})</h3>
                            <div class="content">
                                <div class="pdf-navbar">
                                    <div class="spacer"></div>
            
                                    <div class="page-nav">
                                        <button onclick="changePage('prev')"><</button>
                                        <span>
                                            Page <span id="currentPage"></span> / <span id="totalPage"></span>
                                        </span>
                                        <button onclick="changePage('next')">></button>
                                    </div>
            
                                    <div class="spacer"></div>
                                </div>
            
                                <canvas id="pdfCanvas"></canvas>
                            </div>
                        </div>
            
                        <div>
                            <h3>Ordered PDF Elements</h3>
                            <div class="content">
                                <code id="pdfElementList"></code>
                            </div>
                        </div>
                    </div>
            
                    <script>
                        var pdfData = atob('${base64String}');
                        var pdfjsLib = window['pdfjs-dist/build/pdf'];
                        pdfjsLib.GlobalWorkerOptions.workerSrc = '${resolveAsUri("lib", "build", "pdf.worker.js")}';
            
                        var loadingTask = pdfjsLib.getDocument({data: pdfData});

                        var loadedPdf;
                        var currentPage;
            
                        loadingTask.promise.then(function(pdf) {
                            console.log('PDF loaded');
                            loadedPdf = pdf;

                            // Init page navbar
                            var currentPageElement = document.getElementById('currentPage');
                            currentPageElement.innerText = 1;
                            currentPage = 1;
                            var totalPageElement = document.getElementById('totalPage');
                            totalPageElement.innerText = pdf.numPages;
                        
                            // Fetch the first page
                            var pageNumber = 1;
                            pdf.getPage(pageNumber).then(function(page) {
                                console.log('Page loaded');
                            
                                var scale = 1.5;
                                var viewport = page.getViewport({scale: scale});
                            
                                // Prepare canvas using PDF page dimensions
                                var canvas = document.getElementById('pdfCanvas');
                                var context = canvas.getContext('2d');
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                            
                                // Render PDF page into canvas context
                                var renderContext = {
                                    canvasContext: context,
                                    viewport: viewport
                                 };
                                var renderTask = page.render(renderContext);
                                renderTask.promise.then(function () {
                                    console.log('Page rendered');
                                });
                            });
                        
                            // Parsing the pdf page by page
                            var fileElementList = [];
                            var list = document.getElementById('pdfElementList');
                            for (let i = 0; i < pdf.numPages; i++) {
                                console.log('Getting elements for page ' + (i + 1));
                            
                                pdf.getPage(i + 1).then(function(page) {
                                    let pageContent;
                                    let pageContentTrim = [];
                                
                                    console.log('Tokenizing page...');
                                    page.getTextContent().then(function(tokenizedText) {
                                        /* Parse the content of page and get the str value */
                                        pageContent = tokenizedText.items.map(token => token.str);
                                    
                                        /* Remove empty lines */
                                        pageContent.forEach(function(textElement) {
                                            textElement = textElement.trim();
                                        
                                            if (textElement !== '') {
                                                fileElementList = fileElementList + textElement + '${spacer}';
                                            }
                                        });
                                    
                                        /* Add page elements trim to the complete document */
                                        list.innerText = fileElementList;
                                    });					
                                });				
                            }
                        }, function (reason) {
                            // PDF loading error
                            console.error("Error: " + reason);
                        });

                        function changePage(change) {
                            var currentPageElement = document.getElementById('currentPage');
                            var currentPageNumber = parseInt(currentPageElement.innerText);
                            var pageNumber = (change === "prev") ? currentPage - 1 : currentPage + 1;

                            if (pageNumber < 1) {
                                pageNumber = 1;
                            } else if (pageNumber > loadedPdf.numPages) {
                                pageNumber = loadedPdf.numPages;
                            }

                            console.log("Current: " + currentPage + " / Target: " + pageNumber);

                            loadedPdf.getPage(pageNumber).then(function(page) {
                                console.log('Page loaded');
                          
                                var scale = 1.5;
                                var viewport = page.getViewport({scale: scale});
                          
                                // Prepare canvas using PDF page dimensions
                                var canvas = document.getElementById('pdfCanvas');
                                var context = canvas.getContext('2d');
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                          
                                // Render PDF page into canvas context
                                var renderContext = {
                                    canvasContext: context,
                                    viewport: viewport
                                };
                                var renderTask = page.render(renderContext);
                                renderTask.promise.then(function () {
                                    console.log('Page rendered');
                                    currentPageElement.innerText = pageNumber;
                                    currentPage = pageNumber;
                                });
                            });
                        }
                    </script>
                </body>
            </html>`;
        } else if (mimeType.includes("image")) {
            head = `
                <!DOCTYPE html>
                <html dir="ltr" mozdisallowselectionprint>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                        <meta name="google" content="notranslate">
                        <meta http-equiv="X-UA-Compatible" content="IE=edge">
                        <title>Base 64 Viewer</title>
	                    <link rel="stylesheet" href="${resolveAsUri("src", "viewer.css")}">
                    </head>`;
            body = `
                <body>
                    <div class="title-bar">
                        <h1>Base 64 Viewer</h1>
                    </div>
            
                    <div class="page-content">
                        <h3>${mimeType}  (${fileSize})</h3>
                        <div class="content">
                            <img src="data:${mimeType};base64,${base64String}"/>
                        </div>
                    </div>
                </body>
            </html>`;
        } else if (mimeType.includes("text")) {
            head = `
                <!DOCTYPE html>
                <html dir="ltr" mozdisallowselectionprint>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                        <meta name="google" content="notranslate">
                        <meta http-equiv="X-UA-Compatible" content="IE=edge">
                        <title>Base 64 Viewer</title>
                        <link rel="stylesheet" href="${resolveAsUri("src", "viewer.css")}">
                    </head>`;
            body = `
                <body>
                    <div class="title-bar">
                        <h1>Base 64 Viewer</h1>
                    </div>
            
                    <div class="page-content">
                        <h3>${mimeType}  (${fileSize})</h3>
                        <div class="content">
                            <code id="code-tag"></code>
                        </div>
                    </div>
                        
                    <script>
                        var text = atob('${base64String}');
                        var codeTag = document.getElementById('code-tag');
                        codeTag.innerText = text;
                    </script>
                </body>
            </html>`;
        } else {
            head = `
                <!DOCTYPE html>
                <html dir="ltr" mozdisallowselectionprint>
                    <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                        <meta name="google" content="notranslate">
                        <meta http-equiv="X-UA-Compatible" content="IE=edge">
                        <title>Base 64 Viewer</title>
	                    <link rel="stylesheet" href="${resolveAsUri("src", "viewer.css")}">
                    </head>`;
            body = `
                <body>
                    <div class="title-bar">
                        <h1>Base 64 Viewer</h1>
                    </div>
            
                    <div class="page-content">
                        <h3>${mimeType}  (${fileSize})</h3>
                        <div class="content">
                            <h2>Unsupported format!</h2>
                        </div>
                    </div>
                </body>
            </html>`;
        }

        return head + body;
    }

    private initWebviewEncodingContent(extensionRoot: vscode.Uri, webview: vscode.Webview, content: string, mimeType: string, filePath: string): string {
        const b64u = new Base64Utils();
        const spacer = '  -  ';
        const resolveAsUri = (...p: string[]): vscode.Uri => {
            const uri = vscode.Uri.file(path.join(extensionRoot.path, ...p));
            return webview.asWebviewUri(uri);
        };

        let head = ``;
        let body = ``;

        head = `
            <!DOCTYPE html>
            <html dir="ltr" mozdisallowselectionprint>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
                    <meta name="google" content="notranslate">
                    <meta http-equiv="X-UA-Compatible" content="IE=edge">
                    <title>Base 64 Viewer</title>
                    <link rel="stylesheet" href="${resolveAsUri("src", "viewer.css")}">
                </head>`;
        body = `
            <body>
                <div class="title-bar">
                    <h1>Base 64 Viewer</h1>
                </div>
        
                <div class="page-content">
                    <h3>${mimeType} ${filePath}</h3>
                    <div class="content">
                        <code id="code-tag">${content}</code>
                    </div>
                </div>
            </body>
        </html>`;

        return head + body;
    }
}