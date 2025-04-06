// ==UserScript==
// @name         贴片视频跳转
// @namespace    https://your.namespace.here
// @version      2.0
// @description  Bilibili合集中，允许用户设置时间，当视频播放到用户设置的时间后自动跳到结尾，并等待下一个视频加载
// @author       Your Name
// @match        *://www.bilibili.com/video/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 创建悬浮控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            right: 20px;
            top: 100px;
            background: rgba(0, 0, 0, 0.8);
            padding: 10px;
            border-radius: 8px;
            z-index: 9999;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        `;

        const title = document.createElement('div');
        title.textContent = '视频跳转控制';
        title.style.cssText = `
            font-size: 14px;
            margin-bottom: 10px;
            color: #00a1d6;
        `;

        const timeInput = document.createElement('input');
        timeInput.type = 'number';
        timeInput.value = GM_getValue('targetTime', 510);
        timeInput.style.cssText = `
            width: 80px;
            padding: 4px;
            margin-right: 8px;
            border: 1px solid #00a1d6;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
        `;

        const timeLabel = document.createElement('span');
        timeLabel.textContent = '秒';

        const toggleButton = document.createElement('button');
        toggleButton.textContent = GM_getValue('enabled', true) ? '已启用' : '已禁用';
        toggleButton.style.cssText = `
            display: block;
            margin-top: 8px;
            padding: 4px 8px;
            background: ${GM_getValue('enabled', true) ? '#00a1d6' : '#666'};
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            width: 100%;
        `;

        panel.appendChild(title);
        panel.appendChild(timeInput);
        panel.appendChild(timeLabel);
        panel.appendChild(toggleButton);

        document.body.appendChild(panel);

        // 保存设置
        timeInput.addEventListener('change', () => {
            const value = parseInt(timeInput.value);
            if (!isNaN(value) && value > 0) {
                GM_setValue('targetTime', value);
            }
        });

        // 切换启用状态
        toggleButton.addEventListener('click', () => {
            const enabled = !GM_getValue('enabled', true);
            GM_setValue('enabled', enabled);
            toggleButton.textContent = enabled ? '已启用' : '已禁用';
            toggleButton.style.background = enabled ? '#00a1d6' : '#666';
        });
    }

    // 等待视频加载
    function waitForVideo() {
        const video = document.querySelector('video');

        if (video) {
            console.log('视频已找到，开始监听播放时间');

            // 监听视频播放进度
            video.addEventListener('timeupdate', function() {
                if (!GM_getValue('enabled', true)) return;

                const targetTime = GM_getValue('targetTime', 510);
                if (video.currentTime >= targetTime) {
                    console.log('播放已到达目标时间，跳转到视频结尾');
                    video.currentTime = video.duration;

                    // 确保视频结束并触发下一集的自动播放
                    video.addEventListener('ended', function() {
                        console.log('视频已结束，等待系统加载下一集...');
                    });
                }
            });
        } else {
            // 未找到视频，1秒后重试
            console.log('未找到视频元素，1秒后重试...');
            setTimeout(waitForVideo, 1000);
        }
    }

    // 初始化
    createControlPanel();
    waitForVideo();
})();