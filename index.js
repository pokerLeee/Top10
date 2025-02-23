const express = require('express')
const request = require('request')
const bodyParser = require('body-parser')
const axios = require('axios')
const fs = require('fs')
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const { init: initDB, Counter } = require("./db");

const logger = morgan("tiny");

const PORT = process.env.PORT || 80
const HOST = '0.0.0.0'

const app = express()
app.use(bodyParser.raw())
app.use(bodyParser.json({}))
app.use(bodyParser.urlencoded({ extended: true }))

const client = axios.default

const indexPage = fs.readFileSync('index.html', 'utf-8')
const webPage = fs.readFileSync('web.html', 'utf-8')


app.get('/', async (req, res) => {
    console.log('/ get 接口被调用')
    //res.send(indexPage)
    res.send(webPage)
})

/*
app.get('/', function (req, res) {
    request({
        method: 'POST',
        url: 'http://api.weixin.qq.com/wxa/msg_sec_check',
        body: JSON.stringify({
            openid: 'oyN7n67pI66UH8V0v4JViQ3bkPl4',
            version: 2,
            scene: 2,
            content: '安全检测文本'
        })
    }, function (error, response) {
        console.log('/ get 接口被调用')
        if (error) {
            res.send(error.toString());
        } else {
            console.log('接口返回内容', response.body);
            res.send(JSON.parse(response.body));
        }
    });
});
*/
/*
app.get('/', function (req, res) {
    request({
        method: 'POST',
        //url: 'http://api.weixin.qq.com/wxa/msg_sec_check',
        //url: 'http://api.weixin.qq.com/cgi-bin/callback/check',
        url:  'http://api.weixin.qq.com/cgi-bin/get_api_domain_ip',
        
        body: JSON.stringify({
            action: 'all',
            check_operator: 'DEFAULT'
        })
        
    }, function (error, response) {
        console.log('/ get 接口被调用')
        if (error) {
            res.send(error.toString());
        } else {
            console.log('接口返回内容', response.body);
            res.send(JSON.parse(response.body));
        }
    });
});

*/

app.post("/message/simple", async (req, res) => {
    console.log('消息推送', req.body)
    // 从 header 中取appid，如果 from-appid 不存在，则不是资源复用场景，可以直接传空字符串，使用环境所属账号发起云调用
    const appid = req.headers['x-wx-from-appid'] || ''
    const {ToUserName, FromUserName, MsgType, Content, CreateTime} = req.body
    console.log('推送接收的账号', ToUserName, '创建时间', CreateTime)
    if (MsgType === 'text') {
        //message = await simpleResponse(Content)
        message = `云托管接收消息推送成功，内容如下：\n${JSON.stringify(req.body, null, 2)}`
        res.send({
            ToUserName: FromUserName,
            FromUserName: ToUserName,
            CreateTime: CreateTime,
            MsgType: 'text',
            Content: message,
        })
    } else {
        res.send('success')
    }
})


app.post('/', async (req, res) => {
    console.log('/ post 接口被调用')
    // 没有x-wx-source头的，不是微信的来源，不处理
    if (!req.headers['x-wx-source']) {
        res.status(400).send('Invalid request source')
        return
    }
    
    console.log('==========')
    console.log('收到消息：')
    console.log(req.body)
    console.log('==========')

    /*
    // 免鉴权发送消息
    const weixinAPI = `http://api.weixin.qq.com/cgi-bin/message/custom/send`
    const payload = {
        touser: req.headers['x-wx-openid'],
        msgtype: 'text',
        text: {
            content: `云托管接收消息推送成功，内容如下：\n${JSON.stringify(req.body, null, 2)}`
        }
    }
    const result = await client.post(weixinAPI, payload)
    */
    /*
    //console.log('==========')
    //console.log('Payload:')
    //console.log(payload)
    console.log('==========')
    */
    console.log('发送回复结果：')
    //console.log(result.data)
    console.log('==========')

    //res.send('success')
});

app.listen(PORT, HOST)
console.log(`Running on http://${HOST}:${PORT}`)