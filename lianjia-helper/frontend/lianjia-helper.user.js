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

    // 从列表页面提取所有房源ID
    function extractHouseIdsFromList() {
        const houseIds = [];
        const links = document.querySelectorAll('a.VIEWDATA');
        links.forEach(link => {
            const id = extractHouseId(link.href);
            if (id) houseIds.push(id);
        });
        return houseIds;
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
            margin-left: 10px;
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
        }
        .house-mark-未标记 { background-color: #e0e0e0; }
        .house-mark-推荐 { background-color: #4caf50; color: white; }
        .house-mark-不推荐 { background-color: #f44336; color: white; }
        .house-mark-一般 { background-color: #ffc107; }
        .mark-dropdown {
            position: absolute;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 5px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            display: none;
        }
        .mark-dropdown.show {
            display: block;
        }
        .mark-option {
            padding: 5px 15px;
            cursor: pointer;
        }
        .mark-option:hover {
            background-color: #f5f5f5;
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
        const pageType = detectPageType();
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
        const houseIds = extractHouseIdsFromList();
        if (houseIds.length === 0) return;

        // 批量获取状态
        const statusMap = await batchGetHouseStatus(houseIds);

        const houseItems = document.querySelectorAll('.sellListContent li');
        for (const item of houseItems) {
            const link = item.querySelector('a.VIEWDATA');
            if (!link) continue;

            const houseId = extractHouseId(link.href);
            if (!houseId) continue;

            const status = statusMap[houseId] || '未标记';

            // 创建标记元素
            const markElem = document.createElement('span');
            markElem.className = `house-mark house-mark-${status}`;
            markElem.textContent = status;

            // 添加下拉菜单
            const dropdown = createMarkDropdown();
            markElem.appendChild(dropdown);

            // 添加点击事件
            markElem.addEventListener('click', async (e) => {
                e.stopPropagation();
                const allDropdowns = document.querySelectorAll('.mark-dropdown');
                allDropdowns.forEach(d => d !== dropdown && d.classList.remove('show'));
                dropdown.classList.toggle('show');
            });

            // 处理选项点击
            dropdown.addEventListener('click', async (e) => {
                const option = e.target;
                if (option.classList.contains('mark-option')) {
                    const newStatus = option.textContent;
                    await updateHouseStatus(houseId, newStatus);
                    markElem.className = `house-mark house-mark-${newStatus}`;
                    markElem.childNodes[0].textContent = newStatus;
                    dropdown.classList.remove('show');
                }
            });

            // 将标记添加到房源标题旁
            const titleElem = item.querySelector('.title');
            if (titleElem) {
                titleElem.appendChild(markElem);
            }
        }
    }

    // 监听页面变化
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                processHouseList();
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
    new MutationObserver(() => {
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
    }).observe(document, { subtree: true, childList: true });

    // 点击其他地方关闭下拉菜单
    document.addEventListener('click', () => {
        const dropdowns = document.querySelectorAll('.mark-dropdown');
        dropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    });
})();
