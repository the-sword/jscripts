// ==UserScript==
// @name         贴片视频跳转
// @namespace    https://your.namespace.here
// @version      1.2
// @description  Bilibili合集中，允许用户设置时间，当视频播放到用户设置的时间后自动跳到结尾，并等待下一个视频加载
// @author       Your Name
// @match        *://www.bilibili.com/video/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 提示用户输入跳转时间（秒）
    let targetTime = prompt("请输入视频自动跳转到结尾的时间（单位：秒）", "510");

    // 将用户输入的值转换为整数，如果输入无效则默认为510秒
    targetTime = parseInt(targetTime);
    if (isNaN(targetTime) || targetTime <= 0) {
        targetTime = 510; // 默认值510秒
    }

    console.log(`设定的跳转时间为: ${targetTime} 秒`);

    // 等待视频加载
    function waitForVideo() {
        const video = document.querySelector('video');

        if (video) {
            console.log('视频已找到，开始监听播放时间');

            // 监听视频播放进度
            video.addEventListener('timeupdate', function() {
                if (video.currentTime >= targetTime) {
                    console.log('播放已到达目标时间，跳转到视频结尾');
                    video.currentTime = video.duration; // 直接跳到视频结束

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

    waitForVideo(); // 初次调用，等待视频元素加载
})();