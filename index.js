const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const axios = require('axios')
const fs = require('fs')
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter } = require("./db");

// 读取问题数据
const mildQuestions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'mildQuestion_all.json'), 'utf8')
);

// 配置常量
const CONFIG = {
    PORT: process.env.PORT || 80,
    HOST: '0.0.0.0',
    GAME_BASE_URL: 'https://prod-5gonn6747c1ca31c-1333784425.tcloudbaseapp.com/creatgame.html'
}

// 在文件顶部添加用户房间号映射
const userRoomMap = new Map();

// 在文件顶部添加用户状态映射
const userStateMap = new Map();

// 在文件顶部添加房间玩家映射
const roomPlayersMap = new Map();

// 用户状态类
class UserState {
    constructor(roomNumber, question, currentPlayer, scale) {
        this.roomNumber = roomNumber;
        this.question = question;
        this.currentPlayer = currentPlayer;
        this.scale = scale;
    }
}

// 修改房间类
class RoomState {
    constructor(playerCount) {
        this.playerCount = playerCount;
        this.players = new Map();  // fromUserName -> playerNumber
        this.nextPlayer = 1;
        // 生成初始玩家数字
        this.playerScales = this.generatePlayerScales();
    }

    // 生成所有玩家的数字
    generatePlayerScales() {
        const numbers = [];
        const availableNumbers = Array.from({length: 10}, (_, i) => i + 1);
        
        // 为每个玩家位置生成一个随机数字
        for (let i = 0; i < this.playerCount; i++) {
            const randomIndex = Math.floor(Math.random() * availableNumbers.length);
            numbers[i] = availableNumbers[randomIndex];
            availableNumbers.splice(randomIndex, 1);
        }
        return numbers;
    }

    // 分配玩家编号
    assignPlayer(fromUserName) {
        // 如果玩家已经分配过编号，返回原有编号
        if (this.players.has(fromUserName)) {
            return {
                playerNumber: this.players.get(fromUserName),
                scale: this.playerScales[this.players.get(fromUserName) - 1]
            };
        }
        
        // 如果房间已满，返回null
        if (this.nextPlayer > this.playerCount) {
            return null;
        }
        
        // 分配新编号
        const playerNumber = this.nextPlayer++;
        this.players.set(fromUserName, playerNumber);
        return {
            playerNumber,
            scale: this.playerScales[playerNumber - 1]
        };
    }

    // 重新生成所有玩家的数字
    regenerateScales() {
        this.playerScales = this.generatePlayerScales();
        return this.playerScales;
    }
}

// 初始化 Express 应用
const initializeApp = () => {
    const app = express()
    const logger = morgan("tiny");
    
    app.use(bodyParser.raw())
    app.use(bodyParser.json({}))
    app.use(bodyParser.urlencoded({ extended: true }))
    
    return app
}

// 加载页面内容
const loadPages = () => {
    return {
        indexPage: fs.readFileSync('index.html', 'utf-8'),
        webPage: fs.readFileSync('web.html', 'utf-8')
    }
}

// 解析房间号
const parseRoomNumber = (roomNumber) => {
    if (!/^\d{4}$/.test(roomNumber)) {
        return null;
    }
    
    const playerCount = parseInt(roomNumber[0]);
    const typeNumber = parseInt(roomNumber[1]);
    
    // 验证玩家数量和类型
    if (playerCount < 2 || playerCount > 9) {
        return null;
    }
    
    const typeMap = {
        1: 'mild',
        2: 'spicy',
        3: 'extreme'
    };
    
    const type = typeMap[typeNumber];
    if (!type) {
        return null;
    }
    
    return {
        playerCount,
        type
    };
};

// 生成游戏URL
const generateGameUrl = (roomNumber, selectedQuestion, currentPlayer, scale, playerScales) => {
    const roomInfo = parseRoomNumber(roomNumber);
    
    const gameParams = {
        room: roomNumber,
        players: roomInfo.playerCount,
        type: roomInfo.type,
        currentPlayer: currentPlayer,
        scale: scale,
        question: selectedQuestion.question,
        negative: selectedQuestion.negative,
        positive: selectedQuestion.positive,
        id: selectedQuestion.id,
        numbers: playerScales.join(','),  // 使用房间的 playerScales
        section: 'game'
    }
    
    const queryParams = new URLSearchParams(gameParams)
    return `${CONFIG.GAME_BASE_URL}?${queryParams.toString()}`
}

// 生成结果页URL
const generateResultUrl = (roomNumber, currentPlayer, scale, questionId, playerScales) => {
    const roomInfo = parseRoomNumber(roomNumber);
    
    const queryParams = new URLSearchParams({
        players: roomInfo.playerCount,
        numbers: playerScales.join(','),  // 使用房间的 playerScales
        section: 'result'
    })
    
    return `${CONFIG.GAME_BASE_URL}?${queryParams.toString()}`
}

// 修改生成游戏响应函数
const generateGameResponse = (roomNumber, fromUserName, toUserName, createTime, selectedQuestion, existingState = null, keepScale = false) => {
    const roomInfo = parseRoomNumber(roomNumber);
    if (!roomInfo) {
        return createTextResponse(
            "无效的房间号，请重新输入",
            fromUserName,
            toUserName,
            createTime
        );
    }
    
    // 获取或创建房间状态
    if (!roomPlayersMap.has(roomNumber)) {
        roomPlayersMap.set(roomNumber, new RoomState(roomInfo.playerCount));
    }
    const roomState = roomPlayersMap.get(roomNumber);
    
    // 如果是换题且不保持scale，重新生成所有数字
    if (!keepScale && existingState) {
        roomState.regenerateScales();
    }
    
    // 分配玩家编号和获取数字
    const playerInfo = roomState.assignPlayer(fromUserName);
    if (playerInfo === null) {
        // 直接返回文本响应，而不是包装在对象中
        return createTextResponse(
            `房间 ${roomNumber} 已满，请创建新房间或加入其他房间\n` +
            `<a href='${CONFIG.GAME_BASE_URL}'>点击这里创建房间</a>`,
            fromUserName,
            toUserName,
            createTime
        );
    }
    
    const gameParams = {
        currentPlayer: playerInfo.playerNumber,
        scale: playerInfo.scale
    }
    
    // 使用房间的所有玩家数字生成URL
    const gameUrl = generateGameUrl(roomNumber, selectedQuestion, gameParams.currentPlayer, gameParams.scale, roomState.playerScales)
    const resultUrl = generateResultUrl(roomNumber, gameParams.currentPlayer, gameParams.scale, selectedQuestion.id, roomState.playerScales)
    
    const message = `房间号：${roomNumber}\n` +
        `【${gameParams.currentPlayer}】号玩家，你的号码是【${gameParams.scale}】\n` +
        `<a href='${gameUrl}'>点击查看题目卡片</a>，本轮题目:\n` +
        `${selectedQuestion.question}\n` +
        `1 是最【${selectedQuestion.negative}】，10 是最【${selectedQuestion.positive}】\n` +
        `<a href='${resultUrl}'>点击开始翻牌</a>\n\n` +
        `回复【换】，即可更换题目`
    
    return createTextResponse(message, fromUserName, toUserName, createTime);
}

// 获取随机问题
const getRandomQuestion = (type) => {
    let questions;
    switch (type) {
        case 'mild':
            questions = mildQuestions.questions;
            break;
        case 'spicy':
            // TODO: 加载spicy题目
            questions = mildQuestions.questions;
            break;
        case 'extreme':
            // TODO: 加载extreme题目
            questions = mildQuestions.questions;
            break;
        default:
            questions = mildQuestions.questions;
    }
    
    const randomIndex = Math.floor(Math.random() * questions.length);
    return questions[randomIndex];
}

// 创建文本响应
const createTextResponse = (content, toUser, fromUser, createTime) => {
    return {
        ToUserName: toUser,
        FromUserName: fromUser,
        CreateTime: createTime,
        MsgType: 'text',
        Content: content
    }
}

// 验证请求来源
const validateWeixinSource = (req) => {
    if (!req.headers['x-wx-source']) {
        //return false
        return true
    }
    return true
}

// 处理文本消息
const handleTextMessage = (content, fromUserName, toUserName, createTime, body) => {
    if (content === "Hello world") {
        return createTextResponse(
            `云托管接收消息推送成功，内容如下：\n${JSON.stringify(body, null, 2)}`,
            fromUserName,
            toUserName,
            createTime
        )
    } 
    
    // 处理"开始游戏"
    if (content === "开始游戏" || content === "【开始游戏】") {
        return createTextResponse(
            `欢迎来到脑洞量表(Top Ten)游戏！\n\n` +
            `游戏规则：\n` +
            `脑洞量表是一个简单有趣的合作游戏。建议4-9名玩家参与：\n\n` +
            `1. 一名玩家负责出题，其他玩家抽取数字牌(1-10)\n` +
            `2. 数字越大表示程度越高，比如1最胆小，10最勇敢\n` +
            `3. 每位玩家根据自己抽到的数字，回答出题玩家的问题\n` +
            `4. 出题玩家需要根据大家的回答，判断每个人的数字大小\n` +
            `5. 按照从小到大的顺序翻开数字牌，翻错会扣分\n` +
            `6. 五轮游戏结束后，如果还有分数，所有人共同获胜！\n\n` +
            `准备好了吗？请每位玩家发送4位数字的房间号开始游戏\n` +
            `<a href='${CONFIG.GAME_BASE_URL}'>点击这里创建房间</a>`,
            fromUserName,
            toUserName,
            createTime
        )
    }
    
    if (/^\d{4}$/.test(content)) {
        const roomInfo = parseRoomNumber(content);
        if (!roomInfo) {
            return createTextResponse(
                "无效的房间号，请重新输入\n" +
                `<a href='${CONFIG.GAME_BASE_URL}'>点击这里创建房间</a>`,
                fromUserName,
                toUserName,
                createTime
            );
        }
        
        const userState = userStateMap.get(fromUserName);
        // 如果是相同房间号，使用已存在的题目和玩家信息，包括 scale
        if (userState && userState.roomNumber === content) {
            const result = generateGameResponse(
                content, 
                fromUserName, 
                toUserName, 
                createTime, 
                userState.question, 
                userState, 
                true  // 保持 scale 不变
            );
            return result;  // 返回 response 部分
        }
        // 新房间号，生成新题目和玩家信息
        const selectedQuestion = getRandomQuestion(roomInfo.type);
        const response = generateGameResponse(content, fromUserName, toUserName, createTime, selectedQuestion);
        userStateMap.set(fromUserName, new UserState(content, selectedQuestion, response.currentPlayer, response.scale));
        return response;
    }
    
    // 匹配"换"或【换】
    if (content === "换" || content === "【换】") {
        const userState = userStateMap.get(fromUserName);
        if (!userState) {
            return createTextResponse(
                `请先发送4位数字的房间号\n` +
                `<a href='${CONFIG.GAME_BASE_URL}'>点击这里创建房间</a>`,
                fromUserName,
                toUserName,
                createTime
            );
        }
        // 换题时保持玩家编号但重新生成数字
        const roomInfo = parseRoomNumber(userState.roomNumber);
        const selectedQuestion = getRandomQuestion(roomInfo.type);
        const response = generateGameResponse(
            userState.roomNumber, 
            fromUserName, 
            toUserName, 
            createTime, 
            selectedQuestion, 
            userState, 
            false  // 不保持 scale，生成新的
        );
        // 更新用户状态
        userState.question = selectedQuestion;
        userState.scale = response.scale;
        return response;
    }
    
    // 如果都不匹配，返回帮助信息
    return createTextResponse(
        `欢迎来到脑洞量表(Top Ten)游戏！\n\n` +
        `可用命令：\n` +
        `【开始游戏】- 查看游戏规则\n` +
        `4位数字 - 进入游戏房间\n` +
        `【换】- 更换当前题目\n\n` +
        `<a href='${CONFIG.GAME_BASE_URL}'>点击这里创建房间</a>`,
        fromUserName,
        toUserName,
        createTime
    );
}

// 主函数
const main = () => {
    const app = initializeApp()
    const { indexPage, webPage } = loadPages()
    
    // 路由处理
    app.get('/', async (req, res) => {
        console.log('/ get 接口被调用')
        res.send(indexPage)
    })
    
    app.post("/message/simple", async (req, res) => {
        console.log('消息推送', req.body)
        const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body
        console.log('推送接收的账号', ToUserName, '创建时间', CreateTime)
        
        if (MsgType === 'text') {
            const response = handleTextMessage(Content, FromUserName, ToUserName, CreateTime, req.body)
            res.send(response)
        } else {
            res.send('success')
        }
    })
    
    app.post('/', async (req, res) => {
        console.log('/ post 接口被调用')
        
        if (!validateWeixinSource(req)) {
            res.status(400).send('Invalid request source')
            return
        }
        
        console.log('收到消息：', req.body)
        console.log('发送回复结果：')
    })
    
    // 启动服务器
    app.listen(CONFIG.PORT, CONFIG.HOST)
    console.log(`Running on http://${CONFIG.HOST}:${CONFIG.PORT}`)
}

// 启动应用
main()