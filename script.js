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

  // 生成随机四位数房间号
  const roomNumber = Math.floor(1000 + Math.random() * 9000);
  
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

// 页面加载完成时执行
window.onload = function() {
  const section = getUrlParam('section');
  const roomNumber = getUrlParam('room');
  
  if (section === 'result') {
    // 显示结果页面
    document.getElementById('createSection').style.display = 'none';
    document.getElementById('roomSection').style.display = 'none';
    document.getElementById('resultSection').style.display = 'block';
    displayGameResults();
  } else if (roomNumber) {
    // 显示房间信息
    document.getElementById('createSection').style.display = 'none';
    document.getElementById('roomSection').style.display = 'block';
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
  
  // 隐藏房间信息部分，显示结果部分
  document.getElementById('roomSection').style.display = 'none';
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
  
  // 根据题目类型加载对应的题库
  let selectedQuestion;
  
  if (questionType === 'mild') {
    // 从mild_questions.js中获取题目
    const questions = mildQuestions.questions;
    const randomIndex = Math.floor(Math.random() * questions.length);
    selectedQuestion = questions[randomIndex];
    
    // 构建跳转URL，添加新的参数
    const gameCardUrl = `gamecard.html?room=${roomNumber}&players=${playerCount}&type=${questionType}`
      + `&question=${encodeURIComponent(selectedQuestion.question)}`
      + `&negative=${encodeURIComponent(selectedQuestion.negative)}`
      + `&positive=${encodeURIComponent(selectedQuestion.positive)}`
      + `&scale=${scaleNumber}`
      + `&id=${selectedQuestion.id}`;
    
    // 跳转到游戏卡片页面
    window.location.href = gameCardUrl;
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
    
    // 构建跳转URL，添加新的参数
    const gameCardUrl = `gamecard.html?room=${roomNumber}&players=${playerCount}&type=${questionType}`
      + `&question=${encodeURIComponent(selectedQuestion.question)}`
      + `&negative=${encodeURIComponent(selectedQuestion.negative)}`
      + `&positive=${encodeURIComponent(selectedQuestion.positive)}`
      + `&scale=${scaleNumber}`;
    
    // 跳转到游戏卡片页面
    window.location.href = gameCardUrl;
  }
} 