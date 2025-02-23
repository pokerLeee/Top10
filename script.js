// 判断是否在微信浏览器中
var ua = navigator.userAgent.toLowerCase();
var isWeixin = ua.indexOf('micromessenger') != -1;
//本地测试时 isWeixin 为 true
var isWeixin = true;
if (!isWeixin) {
    window.location.href = "https://open.weixin.qq.com/connect/oauth2/authorize?appid=wx3950a22b4ca1d416"
}

function testClick() {
  alert('按钮点击成功!');
}

function createGame() {
  const playerCount = document.getElementById('playerCount').value;
  const questionType = document.querySelector('input[name="questionType"]:checked').value;
  
  // 验证玩家数量
  if (playerCount < 2 || playerCount > 9) {
    alert('游戏人数必须在2-9人之间！');
    return;
  }

  // 生成房间号
  // a: 玩家数量 (2-9)
  const a = playerCount;
  
  // b: 游戏类型 (1=mild, 2=spicy, 3=extreme)
  const typeMap = {
    'mild': 1,
    'spicy': 2,
    'extreme': 3
  };
  const b = typeMap[questionType];
  
  // cd: 随机数 (00-99)
  const cd = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  
  // 组合成4位数房间号
  const roomNumber = `${a}${b}${cd}`;
  
  // 隐藏创建部分，显示房间信息
  document.getElementById('createSection').style.display = 'none';
  document.getElementById('roomSection').style.display = 'block';
  
  // 更新房间信息
  document.getElementById('roomNumber').textContent = `房间号：${roomNumber}`;
  
  const questionTypeText = {
    mild: '温和题目',
    spicy: '劲爆题目',
    extreme: '没有下限'
  };

  document.getElementById('roomDetails').textContent = 
    `游戏人数：${playerCount}人 | 题目类型：${questionTypeText[questionType]}`;
    
  // 更新 URL 以支持刷新
  window.history.replaceState(null, '', 
    `?room=${roomNumber}&players=${playerCount}&type=${questionType}`);
}

// 获取URL参数的辅助函数
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// 在房间页面加载时显示信息
function displayRoomInfo() {
  // 从URL参数获取信息
  const roomNumber = getUrlParam('room') || '8888'; // 默认房间号8888
  const playerCount = getUrlParam('players') || '6';  // 默认6人
  const questionType = getUrlParam('type') || 'mild'; // 默认温和题目
  
  document.getElementById('roomNumber').textContent = `房间号：${roomNumber}`;
  
  const questionTypeText = {
    mild: '温和题目',
    spicy: '劲爆题目',
    extreme: '没有下限'
  };

  document.getElementById('roomDetails').textContent = 
    `游戏人数：${playerCount}人 | 题目类型：${questionTypeText[questionType]}`;
}

// 生成不重复的随机数
function generateUniqueRandomNumbers(count, min, max) {
  const numbers = new Set();
  while(numbers.size < count) {
    numbers.add(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return Array.from(numbers);
}

// 显示游戏结果
function displayGameResults() {
  // 从URL获取玩家数量和数字
  const playerCount = parseInt(getUrlParam('players')) || 4;
  const numbersString = getUrlParam('numbers');
  const numbers = numbersString ? numbersString.split(',').map(Number) : [];
  
  // 获取结果容器
  const resultsDiv = document.getElementById('playerResults');
  const statusDiv = document.getElementById('gameStatus');
  
  // 清空现有内容
  resultsDiv.innerHTML = '';
  
  // 记录点击顺序、已显示的数字和错误数量
  let clickOrder = 0;
  let revealedNumbers = [];
  let errorCount = 0;
  
  // 更新游戏状态显示
  function updateGameStatus() {
    if (clickOrder < playerCount) {
      statusDiv.textContent = '请翻牌';
    } else {
      // 使用emoji显示结果
      const poopEmoji = '💩';
      const unicornEmoji = '🦄';
      const poops = errorCount > 0 ? poopEmoji.repeat(errorCount) : `${unicornEmoji} 完美！`;
      statusDiv.textContent = `游戏结束 ${poops}`;
    }
  }
  
  // 为每个玩家创建结果显示
  for(let i = 0; i < playerCount; i++) {
    const playerResult = document.createElement('div');
    playerResult.className = 'result-text';
    playerResult.textContent = `${i + 1}号玩家：点击查看`;
    
    // 存储玩家的实际数字
    playerResult.dataset.number = numbers[i];
    
    // 添加点击事件
    playerResult.addEventListener('click', function(event) {
      if (!this.dataset.revealed) {
        const currentNumber = parseInt(this.dataset.number);
        const element = this;
        
        // 添加翻牌动画
        element.classList.add('flipping');
        
        // 在动画中间点更新内容
        setTimeout(() => {
          clickOrder++;
          
          // 检查数字是否小于任何已显示的数字
          const isSmaller = revealedNumbers.some(num => currentNumber <= num);
          if (isSmaller && clickOrder > 1) {
            element.classList.add('error');
            errorCount++;
            // 创建大便emoji动画，传入点击事件
            createPoopEmoji(element, event);
          }
          
          element.textContent = `第${clickOrder}个 - ${i + 1}号玩家：${currentNumber}`;
          element.dataset.revealed = 'true';
          element.classList.add('revealed');
          
          // 添加到已显示数字列表
          revealedNumbers.push(currentNumber);
          
          // 更新状态显示
          updateGameStatus();
        }, 300); // 动画中间点
        
        // 动画结束后移除动画类
        setTimeout(() => {
          element.classList.remove('flipping');
        }, 600); // 动画总时长
      }
    });
    
    resultsDiv.appendChild(playerResult);
  }
  
  // 初始状态显示
  updateGameStatus();
}

// 创建大便emoji动画
function createPoopEmoji(element, event) {
  const rect = element.getBoundingClientRect();
  const emoji = document.createElement('div');
  emoji.textContent = '💩';
  emoji.className = 'floating-poop';
  
  // 使用事件的点击位置，如果没有事件则使用元素中心
  const x = event ? event.clientX : rect.left + rect.width / 2;
  const y = event ? event.clientY : rect.top + rect.height / 2;
  
  // 设置初始位置
  emoji.style.left = (x - 10) + 'px';
  emoji.style.top = (y - 10) + 'px';
  
  document.body.appendChild(emoji);
  
  // 动画结束后移除元素
  emoji.addEventListener('animationend', () => {
    document.body.removeChild(emoji);
  });
}

// 显示游戏卡片
function showGameCard() {
  document.getElementById('createSection').style.display = 'none';
  document.getElementById('roomSection').style.display = 'none';
  document.getElementById('resultSection').style.display = 'none';
  document.getElementById('gameCardSection').style.display = 'block';

  // 获取URL参数
  const urlParams = new URLSearchParams(window.location.search);
  
  // 设置问题和标签文本
  document.getElementById('questionText').textContent = decodeURIComponent(urlParams.get('question') || '说出一位YouTuber。');
  document.getElementById('negativeText').textContent = decodeURIComponent(urlParams.get('negative') || '厌恶');
  document.getElementById('positiveText').textContent = decodeURIComponent(urlParams.get('positive') || '喜爱');
  document.getElementById('questionId').textContent = urlParams.get('id') || '';
  
  // 设置随机数
  const scaleNumber = urlParams.get('scale') || Math.floor(Math.random() * 10) + 1;
  document.getElementById('randomNumber').textContent = scaleNumber;
  
  // 设置玩家标题
  const playerNumber = urlParams.get('currentPlayer') || 1;
  document.getElementById('playerTitle').textContent = `${playerNumber}号玩家 你的号码是`;
  
  // 根据题目类型设置卡片背景颜色和点击效果
  const questionType = urlParams.get('type');
  const card = document.querySelector('.card');
  const numberCard = document.querySelector('.number-card');
  
  if (questionType === 'spicy') {
    card.classList.add('spicy-card');
    numberCard.classList.add('spicy-card');
    // 添加点击事件，创建辣椒emoji
    card.addEventListener('click', createSpicyEmoji);
    numberCard.addEventListener('click', createSpicyEmoji);
  } else if (questionType === 'extreme') {
    card.classList.add('extreme-card');
    numberCard.classList.add('extreme-card');
    // 添加点击事件，创建紫色泡泡
    card.addEventListener('click', createPoisonBubble);
    numberCard.addEventListener('click', createPoisonBubble);
  }
}

// 创建辣椒emoji的函数
function createSpicyEmoji(event) {
  const emoji = document.createElement('div');
  emoji.textContent = '🌶️';
  emoji.className = 'floating-emoji';
  
  // 设置初始位置为点击位置
  emoji.style.left = (event.clientX - 10) + 'px';
  emoji.style.top = (event.clientY - 10) + 'px';
  
  document.body.appendChild(emoji);
  
  // 动画结束后移除元素
  emoji.addEventListener('animationend', () => {
    document.body.removeChild(emoji);
  });
}

// 创建紫色泡泡的函数
function createPoisonBubble(event) {
  const bubble = document.createElement('div');
  bubble.className = 'poison-bubble';
  
  // 设置初始位置为点击位置
  bubble.style.left = (event.clientX - 10) + 'px';
  bubble.style.top = (event.clientY - 10) + 'px';
  
  document.body.appendChild(bubble);
  
  // 动画结束后移除元素
  bubble.addEventListener('animationend', () => {
    document.body.removeChild(bubble);
  });
}

// 页面加载完成时执行
window.onload = function() {
  const section = getUrlParam('section');
  const roomNumber = getUrlParam('room');
  
  if (section === 'result') {
    // 显示结果页面
    document.getElementById('createSection').style.display = 'none';
    document.getElementById('roomSection').style.display = 'none';
    document.getElementById('gameCardSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';
    displayGameResults();
  } else if (getUrlParam('question')) {
    // 显示游戏卡片
    showGameCard();
  } else if (roomNumber) {
    // 显示房间信息
    document.getElementById('createSection').style.display = 'none';
    document.getElementById('roomSection').style.display = 'block';
    document.getElementById('gameCardSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'none';
    displayRoomInfo();
  }
};

function openGameResult() {
  // 从当前页面的 URL 参数中获取玩家数量
  const playerCount = parseInt(getUrlParam('players')) || 4;
  
  // 生成随机数
  const numbers = generateUniqueRandomNumbers(playerCount, 1, 10);
  
  // 将数字数组转换为URL参数
  const numbersParam = numbers.join(',');
  
  // 隐藏所有其他部分，显示结果部分
  document.getElementById('roomSection').style.display = 'none';
  document.getElementById('gameCardSection').style.display = 'none';
  document.getElementById('createSection').style.display = 'none';
  document.getElementById('resultSection').style.display = 'block';
  
  // 更新 URL 以支持刷新
  window.history.replaceState(null, '', 
    `?players=${playerCount}&numbers=${numbersParam}&section=result`);
  
  // 显示游戏结果
  displayGameResults();
}

function openGameCard() {
  // 获取当前URL的参数
  const playerCount = getUrlParam('players');
  const roomNumber = getUrlParam('room');
  const questionType = getUrlParam('type');
  
  // 生成随机数作为scale-number
  const scaleNumber = Math.floor(Math.random() * 10) + 1;
  
  // 生成随机玩家号码（1到playerCount之间）
  const currentPlayer = Math.floor(Math.random() * playerCount) + 1;
  
  // 根据题目类型加载对应的题库
  let selectedQuestion;
  
  if (questionType === 'mild') {
    // 从mild_questions.js中获取题目
    const questions = mildQuestions.questions;
    const randomIndex = Math.floor(Math.random() * questions.length);
    selectedQuestion = questions[randomIndex];
    
    // 构建URL参数
    const gameCardUrl = `?room=${roomNumber}&players=${playerCount}&type=${questionType}`
      + `&question=${encodeURIComponent(selectedQuestion.question)}`
      + `&negative=${encodeURIComponent(selectedQuestion.negative)}`
      + `&positive=${encodeURIComponent(selectedQuestion.positive)}`
      + `&scale=${scaleNumber}`
      + `&id=${selectedQuestion.id}`
      + `&currentPlayer=${currentPlayer}`;
    
    // 更新 URL 并显示游戏卡片
    window.history.replaceState(null, '', gameCardUrl);
    showGameCard();
  } else {
    // 其他类型题目保持原有逻辑
    const questions = {
      spicy: [
        {question: "分享一个秘密。", negative: "羞耻", positive: "自豪"},
        // ...
      ],
      extreme: [
        {question: "最疯狂的想法是什么？", negative: "疯狂", positive: "天才"},
        // ...
      ]
    };
    
    const typeQuestions = questions[questionType] || questions.spicy;
    const randomIndex = Math.floor(Math.random() * typeQuestions.length);
    selectedQuestion = typeQuestions[randomIndex];
    
    // 构建URL参数
    const gameCardUrl = `?room=${roomNumber}&players=${playerCount}&type=${questionType}`
      + `&question=${encodeURIComponent(selectedQuestion.question)}`
      + `&negative=${encodeURIComponent(selectedQuestion.negative)}`
      + `&positive=${encodeURIComponent(selectedQuestion.positive)}`
      + `&scale=${scaleNumber}`;
    
    // 更新 URL 并显示游戏卡片
    window.history.replaceState(null, '', gameCardUrl);
    showGameCard();
  }
} 