// ==UserScript==
// @name         链家助手
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  为链家房源添加标记功能
// @author       Your name
// @match        https://sh.lianjia.com/ershoufang/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const API_BASE_URL = 'http://127.0.0.1:5000/api';  // 替换为你的VPS IP地址

    // 从URL中提取房源ID
    function extractHouseId(url) {
        const match = url.match(/\/ershoufang\/(\d+)\.html/);
        return match ? match[1] : null;
    }

    // 检测当前页面类型
    function detectPageType() {
        const path = window.location.pathname;
        if (path === '/ershoufang/' || path.match(/\/ershoufang\/pg\d+/)) {
            return 'list';
        } else if (path.match(/\/ershoufang\/\d+\.html/)) {
            return 'detail';
        }
        return null;
    }

    // 从列表页面提取所有房源ID和元素
    function extractHouseInfoFromList() {
        const houseInfo = [];
        // 获取房源列表容器
        const listContent = document.querySelector('.sellListContent');
        if (!listContent) {
            console.log('未找到房源列表容器'); // 调试日志
            return houseInfo;
        }

        // 获取所有房源项
        const houseItems = listContent.querySelectorAll('.clear.LOGCLICKDATA, .clear.LOGVIEWDATA');
        console.log('找到房源项数量:', houseItems.length); // 调试日志

        houseItems.forEach(item => {
            // 获取房源链接
            const titleElem = item.querySelector('.title a');
            if (!titleElem) return;

            const id = extractHouseId(titleElem.href);
            if (id) {
                console.log('找到房源ID:', id, '标题:', titleElem.textContent); // 调试日志
                houseInfo.push({
                    id,
                    element: item,
                    titleElement: titleElem
                });
            }
        });

        console.log('共找到有效房源数量:', houseInfo.length); // 调试日志
        return houseInfo;
    }

    // 批量获取房源状态
    async function batchGetHouseStatus(houseIds) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/houses/batch`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ ids: houseIds }),
                onload: function(response) {
                    resolve(JSON.parse(response.responseText));
                },
                onerror: reject
            });
        });
    }

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
        .house-mark {
            display: inline-block;
            margin: 0 5px;
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            position: relative;
            vertical-align: middle;
            font-size: 12px;
            line-height: 1.5;
            z-index: 1;
        }
        .house-mark-未标记 { background-color: #e0e0e0; }
        .house-mark-推荐 { background-color: #4caf50; color: white; }
        .house-mark-不推荐 { background-color: #f44336; color: white; }
        .house-mark-一般 { background-color: #ffc107; }
        .mark-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            z-index: 1000;
            min-width: 80px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 5px 0;
            margin-top: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            display: none;
        }
        .mark-dropdown.show {
            display: block;
        }
        .mark-option {
            padding: 5px 15px;
            cursor: pointer;
            font-size: 12px;
            line-height: 1.5;
            white-space: nowrap;
        }
        .mark-option:hover {
            background-color: #f5f5f5;
        }
        .title-wrapper .house-mark {
            margin-left: 15px;
        }
    `;
    document.head.appendChild(style);

    // 获取房源状态
    async function getHouseStatus(houseId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE_URL}/house/${houseId}`,
                headers: {
                    'Content-Type': 'application/json'
                },
                onload: function(response) {
                    const data = JSON.parse(response.responseText);
                    resolve(data.status);
                },
                onerror: reject
            });
        });
    }

    // 更新房源状态
    async function updateHouseStatus(houseId, status) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/house/${houseId}`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ status }),
                onload: function(response) {
                    resolve(JSON.parse(response.responseText));
                },
                onerror: reject
            });
        });
    }

    // 创建标记下拉菜单
    function createMarkDropdown() {
        const dropdown = document.createElement('div');
        dropdown.className = 'mark-dropdown';
        const options = ['推荐', '不推荐', '一般', '未标记'];

        options.forEach(option => {
            const optionElem = document.createElement('div');
            optionElem.className = 'mark-option';
            optionElem.textContent = option;
            dropdown.appendChild(optionElem);
        });

        return dropdown;
    }

    // 处理房源列表
    async function processHouseList() {
        console.log('开始处理页面...'); // 调试日志
        const pageType = detectPageType();
        console.log('页面类型:', pageType); // 调试日志
        if (!pageType) return;

        if (pageType === 'detail') {
            const houseId = extractHouseId(window.location.href);
            if (houseId) {
                const status = await getHouseStatus(houseId);
                addMarkToDetailPage(status);
            }
            return;
        }

        // 列表页面处理
        const houseInfoList = extractHouseInfoFromList();
        if (houseInfoList.length === 0) {
            console.log('未找到房源信息'); // 调试日志
            return;
        }

        console.log('开始获取房源状态...'); // 调试日志
        // 批量获取状态
        const houseIds = houseInfoList.map(info => info.id);
        const statusMap = await batchGetHouseStatus(houseIds);
        console.log('获取到的状态:', statusMap); // 调试日志

        // 为每个房源添加标记
        for (const info of houseInfoList) {
            const status = statusMap[info.id] || '未标记';
            
            // 检查是否已存在标记
            const existingMark = info.titleElement.parentElement.querySelector('.house-mark');
            if (existingMark) {
                existingMark.className = `house-mark house-mark-${status}`;
                existingMark.childNodes[0].textContent = status;
                continue;
            }
            
            // 创建标记元素
            const markElem = document.createElement('span');
            markElem.className = `house-mark house-mark-${status}`;
            const textNode = document.createTextNode(status);
            markElem.appendChild(textNode);

            // 创建并添加下拉菜单
            const markDropdown = createMarkDropdown();
            markElem.appendChild(markDropdown);

            // 添加点击事件
            markElem.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const allDropdowns = document.querySelectorAll('.mark-dropdown');
                allDropdowns.forEach(d => d !== markDropdown && d.classList.remove('show'));
                markDropdown.classList.toggle('show');
            });

            // 处理选项点击
            markDropdown.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const option = e.target;
                if (option.classList.contains('mark-option')) {
                    const newStatus = option.textContent;
                    await updateHouseStatus(info.id, newStatus);
                    markElem.className = `house-mark house-mark-${newStatus}`;
                    textNode.textContent = newStatus;
                    markDropdown.classList.remove('show');
                }
            });

            // 将标记添加到房源标题后面
            info.titleElement.insertAdjacentElement('afterend', markElem);
            info.titleElement.parentElement.style.position = 'relative';
        }
    }

    // 监听页面变化
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                processHouseList();
                break;
            }
        }
    });

    // 开始监听
    observer.observe(document.body, { childList: true, subtree: true });

    // 为详情页添加标记
    function addMarkToDetailPage(status) {
        const titleElem = document.querySelector('.title-wrapper');
        if (!titleElem) return;

        // 检查是否已存在标记
        const existingMark = titleElem.querySelector('.house-mark');
        if (existingMark) {
            existingMark.className = `house-mark house-mark-${status}`;
            existingMark.childNodes[0].textContent = status;
            return;
        }

        const markElem = document.createElement('span');
        markElem.className = `house-mark house-mark-${status}`;
        markElem.textContent = status;

        // 添加下拉菜单
        const dropdown = createMarkDropdown();
        markElem.appendChild(dropdown);

        // 添加点击事件
        markElem.addEventListener('click', async (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        // 处理选项点击
        dropdown.addEventListener('click', async (e) => {
            const option = e.target;
            if (option.classList.contains('mark-option')) {
                const newStatus = option.textContent;
                const houseId = extractHouseId(window.location.href);
                if (houseId) {
                    await updateHouseStatus(houseId, newStatus);
                    markElem.className = `house-mark house-mark-${newStatus}`;
                    markElem.childNodes[0].textContent = newStatus;
                }
                dropdown.classList.remove('show');
            }
        });

        titleElem.appendChild(markElem);
    }

    // 初始处理
    processHouseList();

    // 监听URL变化（用于SPA页面跳转）
    let lastUrl = location.href;
    let urlCheckTimeout = null;
    
    const urlObserver = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            // 使用防抖来避免多次触发
            if (urlCheckTimeout) {
                clearTimeout(urlCheckTimeout);
            }
            urlCheckTimeout = setTimeout(() => {
                processHouseList();
                urlCheckTimeout = null;
            }, 500);
        }
    });

    // 监听页面变化
    const contentObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                processHouseList();
                break;
            }
        }
    });

    // 开始监听
    urlObserver.observe(document, { subtree: true, childList: true });
    contentObserver.observe(document.body, { childList: true, subtree: true });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        const dropdowns = document.querySelectorAll('.mark-dropdown');
        dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    });
})();
