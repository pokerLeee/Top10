// =========== 导入依赖 ===========
const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const axios = require('axios')
const fs = require('fs')
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter } = require("./db");

// =========== 配置常量 ===========
const CONFIG = {
    PORT: process.env.PORT || 80,
    HOST: '0.0.0.0',
    GAME_BASE_URL: 'https://prod-5gonn6747c1ca31c-1333784425.tcloudbaseapp.com/creatgame.html'
}

// 读取问题数据
const mildQuestions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'mildQuestion_all.json'), 'utf8')
);

// =========== 全局状态管理 ===========
const userStateMap = new Map();  // 用户状态映射
const roomPlayersMap = new Map();  // 房间玩家映射

// =========== 状态类定义 ===========
class UserState {
    constructor(roomNumber, question, currentPlayer, scale) {
        this.roomNumber = roomNumber;
        this.question = question;
        this.currentPlayer = currentPlayer;
        this.scale = scale;
    }
}

class RoomState {
    constructor(playerCount) {
        this.playerCount = playerCount;
        this.players = new Map();  // fromUserName -> playerNumber
        this.nextPlayer = 1;
        this.playerScales = this.generatePlayerScales();
        this.currentQuestion = null;
    }

    generatePlayerScales() {
        const numbers = [];
        const availableNumbers = Array.from({length: 10}, (_, i) => i + 1);
        
        for (let i = 0; i < this.playerCount; i++) {
            const randomIndex = Math.floor(Math.random() * availableNumbers.length);
            numbers[i] = availableNumbers[randomIndex];
            availableNumbers.splice(randomIndex, 1);
        }
        return numbers;
    }

    // 添加 regenerateScales 方法
    regenerateScales() {
        this.playerScales = this.generatePlayerScales();
        // 更新所有玩家的 scale
        for (const [userName, playerNumber] of this.players) {
            const scale = this.playerScales[playerNumber - 1];
            const userState = userStateMap.get(userName);
            if (userState) {
                userState.scale = scale;
            }
        }
    }

    assignPlayer(fromUserName) {
        if (this.players.has(fromUserName)) {
            return {
                playerNumber: this.players.get(fromUserName),
                scale: this.playerScales[this.players.get(fromUserName) - 1]
            };
        }
        
        if (this.nextPlayer > this.playerCount) {
            return null;
        }
        
        const playerNumber = this.nextPlayer++;
        this.players.set(fromUserName, playerNumber);
        return {
            playerNumber,
            scale: this.playerScales[playerNumber - 1]
        };
    }

    getQuestion(type) {
        if (!this.currentQuestion) {
            this.currentQuestion = getRandomQuestion(type);
        }
        return this.currentQuestion;
    }

    changeQuestion(type) {
        this.currentQuestion = getRandomQuestion(type);
        this.regenerateScales();  // 换题时重新生成数字
        return this.currentQuestion;
    }
}

// =========== 工具函数 ===========
function numberToCircled(num) {
    const circledNumbers = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];
    return circledNumbers[num - 1] || num;
}

const parseRoomNumber = (roomNumber) => {
    if (!/^\d{4}$/.test(roomNumber)) return null;
    
    const playerCount = parseInt(roomNumber[0]);
    const typeNumber = parseInt(roomNumber[1]);
    
    if (playerCount < 2 || playerCount > 9) return null;
    
    const typeMap = {
        1: 'mild',
        2: 'spicy',
        3: 'extreme'
    };
    
    const type = typeMap[typeNumber];
    return type ? { playerCount, type } : null;
};

// =========== 游戏逻辑函数 ===========
const getRandomQuestion = (type) => {
    // TODO: 加载不同类型的题目
    return mildQuestions.questions[Math.floor(Math.random() * mildQuestions.questions.length)];
}

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
        numbers: playerScales.join(','),
        section: 'game'
    }
    
    return `${CONFIG.GAME_BASE_URL}?${new URLSearchParams(gameParams).toString()}`
}

const generateResultUrl = (roomNumber, currentPlayer, scale, questionId, playerScales) => {
    const roomInfo = parseRoomNumber(roomNumber);
    const queryParams = new URLSearchParams({
        players: roomInfo.playerCount,
        numbers: playerScales.join(','),
        section: 'result'
    })
    
    return `${CONFIG.GAME_BASE_URL}?${queryParams.toString()}`
}

// =========== 消息处理 ===========
const createTextResponse = (content, toUser, fromUser, createTime) => ({
    ToUserName: toUser,
    FromUserName: fromUser,
    CreateTime: createTime,
    MsgType: 'text',
    Content: content
})

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
        
        // 获取或创建房间状态
        if (!roomPlayersMap.has(content)) {
            roomPlayersMap.set(content, new RoomState(roomInfo.playerCount));
        }
        const roomState = roomPlayersMap.get(content);
        
        // 获取房间的题目
        const selectedQuestion = roomState.getQuestion(roomInfo.type);
        
        const response = generateGameResponse(content, fromUserName, toUserName, createTime, selectedQuestion);
        // 只存储玩家编号和数字，题目由房间管理
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
        
        const roomInfo = parseRoomNumber(userState.roomNumber);
        const roomState = roomPlayersMap.get(userState.roomNumber);
        // 使用房间的换题方法
        const selectedQuestion = roomState.changeQuestion(roomInfo.type);
        
        const response = generateGameResponse(
            userState.roomNumber, 
            fromUserName, 
            toUserName, 
            createTime, 
            selectedQuestion, 
            userState, 
            false  // 不保持 scale，使用房间新生成的数字
        );
        
        // 更新用户状态
        userState.question = selectedQuestion;
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
    )
}

const generateGameResponse = (roomNumber, fromUserName, toUserName, createTime, selectedQuestion, existingState = null, keepScale = false) => {
    const roomInfo = parseRoomNumber(roomNumber);
    if (!roomInfo) {
        return createTextResponse(
            "无效的房间号，请重新输入\n" +
            `<a href='${CONFIG.GAME_BASE_URL}'>点击这里创建房间</a>`,
            fromUserName,
            toUserName,
            createTime
        );
    }
    
    if (!roomPlayersMap.has(roomNumber)) {
        roomPlayersMap.set(roomNumber, new RoomState(roomInfo.playerCount));
    }
    const roomState = roomPlayersMap.get(roomNumber);
    
    if (!keepScale && existingState) {
        roomState.regenerateScales();
    }
    
    const playerInfo = roomState.assignPlayer(fromUserName);
    if (playerInfo === null) {
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
    
    const gameUrl = generateGameUrl(roomNumber, selectedQuestion, gameParams.currentPlayer, gameParams.scale, roomState.playerScales)
    const resultUrl = generateResultUrl(roomNumber, gameParams.currentPlayer, gameParams.scale, selectedQuestion.id, roomState.playerScales)
    
    const message = `房间号：${roomNumber}\n` +
        `你是【${gameParams.currentPlayer}】号玩家，你的号码是 ${numberToCircled(gameParams.scale)}\n` +
        `本轮题目:\n` +
        `<a href='${gameUrl}'>点击查看题目卡片</a>\n` +
        `${selectedQuestion.question}\n` +
        `① 是最【${selectedQuestion.negative}】，⑩ 是最【${selectedQuestion.positive}】\n` +
        `<a href='${resultUrl}'>点击翻看结果</a>\n\n` +
        `游戏结束回复【换】，可更换题目`
    
    return createTextResponse(message, fromUserName, toUserName, createTime);
}

// =========== 服务器设置 ===========
const initializeApp = () => {
    const app = express()
    app.use(morgan("tiny"))
    app.use(bodyParser.raw())
    app.use(bodyParser.json({}))
    app.use(bodyParser.urlencoded({ extended: true }))
    return app
}

const loadPages = () => ({
    indexPage: fs.readFileSync('index.html', 'utf-8'),
    webPage: fs.readFileSync('web.html', 'utf-8')
})

// =========== 主函数 ===========
const main = () => {
    const app = initializeApp()
    const { indexPage, webPage } = loadPages()
    
    app.get('/', async (req, res) => {
        res.send(indexPage)
    })
    
    app.post("/message/simple", async (req, res) => {
        const { ToUserName, FromUserName, MsgType, Content, CreateTime } = req.body
        
        if (MsgType === 'text') {
            const response = handleTextMessage(Content, FromUserName, ToUserName, CreateTime, req.body)
            res.send(response)
        } else {
            res.send('success')
        }
    })
    
    app.listen(CONFIG.PORT, CONFIG.HOST)
    console.log(`Running on http://${CONFIG.HOST}:${CONFIG.PORT}`)
}

main()