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

// 用户状态类
class UserState {
    constructor(roomNumber, question) {
        this.roomNumber = roomNumber;
        this.question = question;
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

// 生成随机数字数组
const generateUniqueRandomNumbers = (count, min = 1, max = 10) => {
    const numbers = [];
    while (numbers.length < count) {
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        if (!numbers.includes(num)) {
            numbers.push(num);
        }
    }
    return numbers;
}

// 生成结果页URL
const generateResultUrl = (roomNumber) => {
    const playerCount = 6;
    const numbers = generateUniqueRandomNumbers(playerCount);
    
    const queryParams = new URLSearchParams({
        players: playerCount,
        numbers: numbers.join(','),
        section: 'result'
    })
    
    return `${CONFIG.GAME_BASE_URL}?${queryParams.toString()}`
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
        const userState = userStateMap.get(fromUserName);
        // 如果是相同房间号，使用已存在的题目
        if (userState && userState.roomNumber === content) {
            return generateGameResponse(content, fromUserName, toUserName, createTime, userState.question);
        }
        // 新房间号，生成新题目
        const selectedQuestion = getRandomQuestion();
        userStateMap.set(fromUserName, new UserState(content, selectedQuestion));
        return generateGameResponse(content, fromUserName, toUserName, createTime, selectedQuestion);
    }
    
    // 匹配"换"或【换】
    if (content === "换" || content === "【换】") {
        const userState = userStateMap.get(fromUserName);
        if (!userState) {
            return createTextResponse(
                `请先发送4位数字的房间号\n` +
                `<a href='${CONFIG.GAME_BASE_URL}'>点击这里生成房间</a>`,
                fromUserName,
                toUserName,
                createTime
            );
        }
        // 换题时生成新题目
        const selectedQuestion = getRandomQuestion();
        userState.question = selectedQuestion;
        return generateGameResponse(userState.roomNumber, fromUserName, toUserName, createTime, selectedQuestion);
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
    )
}

// 生成游戏响应
const generateGameResponse = (roomNumber, fromUserName, toUserName, createTime, selectedQuestion) => {
    const gameParams = {
        currentPlayer: 5,
        scale: 2
    }
    
    const gameUrl = generateGameUrl(roomNumber, selectedQuestion)
    const resultUrl = generateResultUrl(roomNumber)
    
    const message = `房间号：${roomNumber}\n` +
    `【${gameParams.currentPlayer}】号玩家，你的号码是【${gameParams.scale}】\n` +
        `<a href='${gameUrl}'>点击查看题目卡片</a>\n` +
        `本轮题目: \n` +
        `${selectedQuestion.question}\n\n` +
        `1 是最${selectedQuestion.negative}，10 是最${selectedQuestion.positive}\n` +
        `<a href='${resultUrl}'>点击开始翻牌</a>\n` +
        `回复【换】，即可更换题目`
    
    return createTextResponse(
        message,
        fromUserName,
        toUserName,
        createTime
    )
}

// 生成游戏URL
const generateGameUrl = (roomNumber, selectedQuestion) => {
    const gameParams = {
        room: roomNumber,
        players: 6,
        type: 'mild',
        currentPlayer: 5,
        scale: 2,
        question: selectedQuestion.question,
        negative: selectedQuestion.negative,
        positive: selectedQuestion.positive,
        id: selectedQuestion.id
    }
    
    const queryParams = new URLSearchParams(gameParams)
    return `${CONFIG.GAME_BASE_URL}?${queryParams.toString()}`
}

// 获取随机问题
const getRandomQuestion = () => {
    const questions = mildQuestions.questions
    const randomIndex = Math.floor(Math.random() * questions.length)
    return questions[randomIndex]
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