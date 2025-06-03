// ==UserScript==
// @name         链家助手
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  为链家房源添加标记功能
// @author       Your name
// @match        https://*.lianjia.com/ershoufang/*
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
        // 详情页匹配
        if (path.match(/\/ershoufang\/\d+\.html/)) {
            return 'detail';
        }
        // 列表页匹配：包括主列表、分页、区域列表等
        if (path.includes('/ershoufang/')) {
            return 'list';
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
        .house-favorite-button {
            display: inline-block;
            margin: 0 5px;
            padding: 2px 8px;
            border-radius: 4px;
            cursor: pointer;
            vertical-align: middle;
            font-size: 14px; /* Slightly larger for icon */
            line-height: 1.5;
            z-index: 1;
            border: 1px solid #ccc;
            background-color: #f0f0f0;
        }
        .house-favorite-button.favorited {
            background-color: #ffeb3b; /* Yellow for favorited */
            border-color: #fbc02d;
        }
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
        .title-wrapper .house-mark, .title-wrapper .house-favorite-button {
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
                    resolve(data); // Resolve with the whole object {status, favorite}
                },
                onerror: reject
            });
        });
    }

    // 更新房源收藏状态
    async function updateHouseFavorite(houseId, favorite) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE_URL}/house/${houseId}/favorite`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ favorite }), // favorite should be 0 or 1
                onload: function(response) {
                    resolve(JSON.parse(response.responseText));
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

    // 创建收藏按钮
    function createFavoriteButton(houseId, initialFavoriteStatus) {
        const button = document.createElement('span');
        button.className = 'house-favorite-button';
        let isFavorited = initialFavoriteStatus === 1;

        function updateButtonAppearance() {
            button.textContent = isFavorited ? '★ 已收藏' : '☆ 收藏';
            if (isFavorited) {
                button.classList.add('favorited');
            } else {
                button.classList.remove('favorited');
            }
        }

        updateButtonAppearance();

        button.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent interference with other click listeners
            const newFavoriteState = isFavorited ? 0 : 1;
            try {
                await updateHouseFavorite(houseId, newFavoriteState);
                isFavorited = newFavoriteState === 1;
                updateButtonAppearance();
            } catch (error) {
                console.error('Failed to update favorite status:', error);
                // Optionally, revert button appearance or show an error message
            }
        });

        return button;
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
                const houseData = await getHouseStatus(houseId); // Now returns {status, favorite}
                addMarkToDetailPage(houseData.status, houseData.favorite);
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

        const houseIds = houseInfoList.map(info => info.id);
        const houseDataMap = await batchGetHouseStatus(houseIds); // Expects {houseId: {status, favorite}}
        console.log('获取到的状态:', houseDataMap); // 调试日志

        for (const info of houseInfoList) {
            const houseData = houseDataMap[info.id] || { status: '未标记', favorite: 0 };

            let targetContainer = info.element.querySelector('.title'); // Prefer '.title' div within the item
            if (!targetContainer && info.titleElement) {
                targetContainer = info.titleElement.parentElement; // Fallback to title link's parent
            }
            if (!targetContainer) {
                 console.warn('Could not find a suitable container for house ID:', info.id, 'in list view. Element:', info.element);
                 targetContainer = info.element; // Last resort, append to the item itself
            }

            // 清理旧标记和按钮
            targetContainer.querySelectorAll('.house-mark, .house-favorite-button').forEach(el => el.remove());

            // 创建收藏按钮
            const favoriteButton = createFavoriteButton(info.id, houseData.favorite);

            // 创建标记元素 (status part)
            const markElem = document.createElement('span');
            markElem.className = `house-mark house-mark-${houseData.status}`;
            const textNode = document.createTextNode(houseData.status);
            markElem.appendChild(textNode);

            const markDropdown = createMarkDropdown();
            markElem.appendChild(markDropdown);

            markElem.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                // Close other open dropdowns
                document.querySelectorAll('.mark-dropdown.show').forEach(d => {
                    if (d !== markDropdown) d.classList.remove('show');
                });
                markDropdown.classList.toggle('show');
            });

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
            
            // Append new elements to the identified container
            targetContainer.appendChild(favoriteButton);
            targetContainer.appendChild(markElem);
        }
    }

    // 为详情页添加标记和收藏按钮
    function addMarkToDetailPage(status, favorite) { // Added favorite parameter
        // More robust selectors for detail page title area
        const titleMainElement = document.querySelector('.sellDetailHeader .title .main, .overviewClear .title .main');
        let titleContainer = document.querySelector('.sellDetailHeader .title, .overviewClear .title'); // This is usually the div we want to append to

        let targetAppendElement = titleContainer; // Default to the .title div

        if (!targetAppendElement && titleMainElement && titleMainElement.parentElement) {
            // If .title div wasn't found, but .main was, use .main's parent
            targetAppendElement = titleMainElement.parentElement;
        } else if (!targetAppendElement && !titleMainElement) {
             // Fallback if specific selectors fail, try a more generic one
            targetAppendElement = document.querySelector('div.title'); // A common generic title div
        }

        if (!targetAppendElement) {
            console.error('LJH: Detail page title container could not be reliably found.');
            return;
        }

        // 清理旧标记和按钮 from the chosen container
        targetAppendElement.querySelectorAll('.house-mark, .house-favorite-button').forEach(el => el.remove());

        const houseId = extractHouseId(window.location.href);
        if (!houseId) return;

        // 创建收藏按钮
        const favoriteButton = createFavoriteButton(houseId, favorite);

        // 创建标记元素 (status part)
        const markElem = document.createElement('span');
        markElem.className = `house-mark house-mark-${status}`;
        const textNode = document.createTextNode(status);
        markElem.appendChild(textNode);

        const markDropdown = createMarkDropdown();
        markElem.appendChild(markDropdown);

        markElem.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            document.querySelectorAll('.mark-dropdown.show').forEach(d => {
                if (d !== markDropdown) d.classList.remove('show');
            });
            markDropdown.classList.toggle('show');
        });

        markDropdown.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            const option = e.target;
            if (option.classList.contains('mark-option')) {
                const newStatus = option.textContent;
                await updateHouseStatus(houseId, newStatus);
                markElem.className = `house-mark house-mark-${newStatus}`;
                textNode.textContent = newStatus;
                markDropdown.classList.remove('show');
            }
        });

        // 将新按钮和标记元素添加到目标容器的末尾
        targetAppendElement.appendChild(favoriteButton);
        targetAppendElement.appendChild(markElem);
    }

    // 初始处理
    processHouseList();

    // --- Observers and Global Event Listeners ---

    // Debounce helper
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    const debouncedProcessHouseList = debounce(processHouseList, 750);

    // Observer for URL changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('LJH: URL changed, reprocessing.');
            debouncedProcessHouseList(); // Use debounced version
        }
    }).observe(document, { subtree: true, childList: true }); // Observe document for title changes/SPA nav

    // Observer for dynamic content changes (e.g., list updates, infinite scroll)
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if the added nodes are relevant (e.g., new house items)
                let relevantChange = false;
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if added node is a list item or contains list items
                        if ((node.matches && node.matches('.sellListContent > .clear')) || 
                            (node.querySelector && node.querySelector('.sellListContent > .clear')) ||
                            (mutation.target && mutation.target.matches && mutation.target.matches('.sellListContent'))) {
                            relevantChange = true;
                            break;
                        }
                    }
                }
                if (relevantChange) {
                    console.log('LJH: Content changed, reprocessing list.');
                    debouncedProcessHouseList(); // Use debounced version
                    return; // Process once per batch of mutations
                }
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

    // Global click listener to close dropdowns
    document.addEventListener('click', (event) => {
        // If the click is not on a mark element or inside a dropdown, close all dropdowns
        if (!event.target.closest('.house-mark')) {
            document.querySelectorAll('.mark-dropdown.show').forEach(dropdown => {
                dropdown.classList.remove('show');
            });
        }
    });

})();
