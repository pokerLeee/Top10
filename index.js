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
    fs.readFileSync(path.join(__dirname, 'mildQuestion.json'), 'utf8')
);

// 配置常量
const CONFIG = {
    PORT: process.env.PORT || 80,
    HOST: '0.0.0.0',
    GAME_BASE_URL: 'https://prod-5gonn6747c1ca31c-1333784425.tcloudbaseapp.com/creatgame.html'
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
    
    if (/^\d{4}$/.test(content)) {
        const gameUrl = generateGameUrl(content)
        const resultUrl = generateResultUrl(content)
        const gameParams = {
            currentPlayer: 5,
            scale: 2
        }
        const selectedQuestion = getRandomQuestion()
        
        const message = `${gameParams.currentPlayer}号玩家，你的号码是${gameParams.scale}\n` +
            `<a href='${gameUrl}'>点击查看题目卡片</a>\n` +
            `本轮题目是: \n` +
            `${selectedQuestion.question}\n` +
            `1是最${selectedQuestion.negative}，10是最${selectedQuestion.positive}\n` +
            `<a href='${resultUrl}'>点击开始翻牌</a>`
        
        return createTextResponse(
            message,
            fromUserName,
            toUserName,
            createTime
        )
    }
    
    return createTextResponse(
        `云托管接收消息推送成功，内容如下：\n${JSON.stringify(body, null, 2)}`,
        fromUserName,
        toUserName,
        createTime
    )
}

// 生成游戏URL
const generateGameUrl = (roomNumber) => {
    const gameParams = {
        room: roomNumber,
        players: 6,
        type: 'mild',
        currentPlayer: 5,
        scale: 2
    }
    
    const selectedQuestion = getRandomQuestion()
    
    const queryParams = new URLSearchParams({
        ...gameParams,
        question: selectedQuestion.question,
        negative: selectedQuestion.negative,
        positive: selectedQuestion.positive,
        id: selectedQuestion.id
    })
    
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