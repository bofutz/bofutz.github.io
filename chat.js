/**
 * 波幅探长 - 在线客服模块 (chat.js)
 * 支持文字交流、图片发送与预览、离线缓存与自动回复
 */
function useChatModule(Vue) {
    const { ref, watch, nextTick } = Vue;

    const chatOpen = ref(false);
    const chatInput = ref('');
    const unreadCount = ref(0);
    const chatScrollArea = ref(null);

    const chatMessages = ref([
        {
            sender: 'bot',
            type: 'text',
            content: '👋 您好！欢迎访问波幅探长在线客服。\n如需咨询套餐开通、数据说明或意见反馈，欢迎在此发送消息或图片联系我们！',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);

    // 从本地存储读取历史客服聊天记录
    try {
        const savedChat = localStorage.getItem('bofu_chat_messages');
        if (savedChat) {
            const parsed = JSON.parse(savedChat);
            if (Array.isArray(parsed) && parsed.length > 0) chatMessages.value = parsed;
        }
    } catch (e) {}

    const saveChatMessages = () => {
        try { localStorage.setItem('bofu_chat_messages', JSON.stringify(chatMessages.value)); } catch (e) {}
    };

    const scrollToChatBottom = () => {
        nextTick(() => {
            if (chatScrollArea.value) chatScrollArea.value.scrollTop = chatScrollArea.value.scrollHeight;
        });
    };

    const sendChatMessage = () => {
        const text = chatInput.value.trim();
        if (!text) return;

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        chatMessages.value.push({ sender: 'user', type: 'text', content: text, time: nowTime });
        chatInput.value = '';
        saveChatMessages();
        scrollToChatBottom();

        // 模拟客服专员自动回复逻辑
        setTimeout(() => {
            let botReply = '收到您的留言！客服专员正在处理中，稍后会为您核对回复。';
            if (text.includes('VIP') || text.includes('套餐') || text.includes('充值')) {
                botReply = '关于套餐开通：我们支持微信扫码V免签模式，付款微浮动金额后 3 秒内系统自动激活 VIP！若未到账请保留微信转账截图并在此发送给客服。';
            } else if (text.includes('免费') || text.includes('体验')) {
                botReply = '新注册用户免费赠送 1 天体验权限；首页表格前 3 名标的数据免费全网开放体验！';
            }
            
            chatMessages.value.push({ sender: 'bot', type: 'text', content: botReply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
            if (!chatOpen.value) unreadCount.value++;
            saveChatMessages();
            scrollToChatBottom();
        }, 1000);
    };

    const handleChatImageUpload = (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('图片大小不能超过 5MB'); return; }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imgData = e.target.result;
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            chatMessages.value.push({ sender: 'user', type: 'image', content: imgData, time: nowTime });
            saveChatMessages();
            scrollToChatBottom();

            setTimeout(() => {
                chatMessages.value.push({ sender: 'bot', type: 'text', content: '已收到您发送的图片凭证，客服人员会即刻帮您核对！', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
                saveChatMessages();
                scrollToChatBottom();
            }, 1200);
        };
        reader.readAsDataURL(file);
    };

    const previewChatImage = (imgUrl) => {
        const image = new Image(); image.src = imgUrl; 
        const viewer = new Viewer(image, { hidden: () => viewer.destroy(), navbar: false, title: false, button: true, backdrop: true });
        viewer.show();
    };

    watch(chatOpen, (isOpen) => { if (isOpen) { unreadCount.value = 0; scrollToChatBottom(); } });

    return { chatOpen, chatInput, unreadCount, chatScrollArea, chatMessages, sendChatMessage, handleChatImageUpload, previewChatImage };
}
