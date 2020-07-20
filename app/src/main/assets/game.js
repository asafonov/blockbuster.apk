class AbstractBonus {
  constructor (hero, obj) {
    this.timeout = 20000;
    this.hero = hero;
    this.obj = obj
    this.reverseProxy = this.reverse.bind(this);
  }

  // stub for override
  getMessage() {
  }

  // stub for override
  apply() {
    asafonov.messageBus.send(asafonov.events.BONUS_APPLIED, {message: this.getMessage()});
    setTimeout(this.reverseProxy, this.timeout);
  }

  // stub for override
  reverse() {
  }
}
class Ball {

  constructor() {
    this.position = new Point(0, 0);
    this.direction = Math.random() > 0.5 ? Ball.DIRECTION_UPRIGHT : Ball.DIRECTION_UPLEFT;
    this.angle = Math.random() > 0.5 ? 1 : 1/2;
    this.speed = asafonov.settings.ballSpeed;
    this.interval = setInterval(this.move.bind(this), 50);
  }

  moveByDelta (delta) {
    this.moveTo(this.position.x + delta.x, this.position.y + delta.y);
  }

  move() {
    var x = this.direction == Ball.DIRECTION_UPRIGHT || this.direction == Ball.DIRECTION_DOWNRIGHT ? 1 : -1;
    var y = this.direction == Ball.DIRECTION_UPRIGHT || this.direction == Ball.DIRECTION_UPLEFT ? -1 : 1;
    this.moveByDelta(new Point(x * this.angle * this.speed, y * this.speed));
  }

  moveTo (x, y) {
    var position = new Point(this.position.x, this.position.y);
    this.position.x = x;
    this.position.y = y;
    asafonov.messageBus.send(asafonov.events.BALL_MOVED, {obj: this, fromPosition: position});
  }

  changeDirection (wallType) {
    if (wallType == Ball.CORNER_WALL) {
      if (this.direction == Ball.DIRECTION_UPRIGHT) {
        this.direction = Ball.DIRECTION_DOWNLEFT;
      } else if (this.direction == Ball.DIRECTION_UPLEFT) {
        this.direction = Ball.DIRECTION_DOWNRIGHT;
      } else if (this.direction == Ball.DIRECTION_DOWNRIGHT) {
        this.direction = Ball.DIRECTION_UPLEFT;
      } else {
        this.direction = Ball.DIRECTION_UPRIGHT;
      }
    } else if (wallType == Ball.VERTICAL_WALL) {
      this.direction += this.direction % 2 == 1 ? 1 : -1;
    } else if (wallType == Ball.HORIZONTAL_WALL) {
      this.direction += this.direction < 3 ? 2 : -2;
    }

    asafonov.messageBus.send(asafonov.events.BALL_CHANGED_DIRECTION, {});
  }

  destroy() {
    clearInterval(this.interval);
    console.log("Ball destroy");
  }
}

Ball.DIRECTION_UPRIGHT = 1;
Ball.DIRECTION_UPLEFT = 2;
Ball.DIRECTION_DOWNRIGHT = 3;
Ball.DIRECTION_DOWNLEFT = 4;
Ball.HORIZONTAL_WALL = 1;
Ball.VERTICAL_WALL = 2;
Ball.CORNER_WALL = 3;
class BallSpeedBonus extends AbstractBonus {
  constructor (hero, obj) {
    super(hero, obj);
    this.speed = Math.random() < 0.5 ? asafonov.settings.ballSpeed * 3/4 : asafonov.settings.ballSpeed * 1.5;
  }

  getMessage() {
    return "Ball's speed has changed";
  }

  apply() {
    this.obj.speed = this.speed;
    super.apply();
  }

  reverse() {
    this.obj.speed = asafonov.settings.ballSpeed;
  }
}
class Field {

  constructor (width, height) {
    this.width = width || 40;
    this.height = height || 30;
    this.objects = [];
    this.objectsCount = 0;
    this.hero = null;
    this.ball = null;
    asafonov.messageBus.subscribe(asafonov.events.FIELD_HERO_MOVED, this, 'onHeroMoved');
    asafonov.messageBus.subscribe(asafonov.events.BALL_MOVED, this, 'onBallMoved');
  }

  setHero (hero) {
    this.hero = hero;
    this.hero.moveTo(this.width / 2 - (this.hero.width + 1) / 2, this.height - 1);
    asafonov.messageBus.send(asafonov.events.FIELD_HERO_ADDED, {field: this});
  }

  setBall (ball) {
    this.ball = ball;
    this.ball.moveTo(this.width / 2 - 1, this.height - 2);
    asafonov.messageBus.send(asafonov.BALL_ADDED, {field: this, ball: ball});
  }

  getHero() {
    return this.hero;
  }

  getHeroPosition() {
    return this.hero.position;
  }

  onHeroMoved (eventData) {
    this.correctPosition(eventData.obj);
  }

  onBallMoved (eventData) {
    this.correctBallPosition(eventData.obj, eventData.fromPosition);
  }

  positionToIndex (position) {
    return parseInt(position.y, 10) * this.width + parseInt(position.x, 10);
  }

  indexToPosition (index) {
    return new Point(index % this.width, parseInt(index / this.width, 10));
  }

  setObjectMap (objects) {
    for (var i = 0; i < objects.length; ++i) {
      if (objects[i] !== null && objects[i] !== undefined) {
        this.addObject(objects[i], this.indexToPosition(i));
      }
    }
  }

  addObject (type, position) {
    var index = this.positionToIndex(position);
    this.objects[index] = type;
    asafonov.messageBus.send(asafonov.events.OBJECT_ADDED, {type: type, position: position, index: index});

    if (type !== null && type !== undefined && type > 0) {
      ++this.objectsCount;
    }
  }

  correctPosition (obj) {
    if (obj.position.x < 0 || obj.position.x + obj.width > this.width) {
      obj.moveTo(obj.position.x < 0 ? 0 : this.width - obj.width, obj.position.y);
    }
  }

  checkCollision (obj) {
    var affectedPositions = [
      this.positionToIndex(obj.position),
      this.positionToIndex({x: obj.position.x - 1, y: obj.position.y}),
      this.positionToIndex({x: obj.position.x + 1, y: obj.position.y}),
      this.positionToIndex({x: obj.position.x - 1, y: obj.position.y + 1}),
      this.positionToIndex({x: obj.position.x, y: obj.position.y + 1}),
      this.positionToIndex({x: obj.position.x + 1, y: obj.position.y + 1}),
      this.positionToIndex({x: obj.position.x - 1, y: obj.position.y - 1}),
      this.positionToIndex({x: obj.position.x, y: obj.position.y - 1}),
      this.positionToIndex({x: obj.position.x + 1, y: obj.position.y - 1})
    ];
    var collision = false;
    var isVerticalWall = (this.objects[affectedPositions[1]] > 0 && (obj.direction == Ball.DIRECTION_UPLEFT || obj.direction == Ball.DIRECTION_DOWNLEFT))
      || (this.objects[affectedPositions[2]] > 0 && (obj.direction == Ball.DIRECTION_UPRIGHT || obj.direction == Ball.DIRECTION_DOWNRIGHT));

    for (var i = 0; i < affectedPositions.length; ++i) {
      if (this.objects[affectedPositions[i]] !== null && this.objects[affectedPositions[i]] !== undefined && this.objects[affectedPositions[i]] > 0) {
        this.processObjectCollision(affectedPositions[i]);
        collision = true;
      }
    }

    if (collision) {
      var downPositionIndex = this.positionToIndex({x: obj.position.x, y: obj.position.y + 1});
      obj.changeDirection(Ball[isVerticalWall ? 'VERTICAL_WALL' : 'HORIZONTAL_WALL']);
      this.applyBonuses(obj);

      if (this.objectsCount <= 0) {
        asafonov.messageBus.send(asafonov.events.GAME_WON, {});
      }
    }

    return collision;
  }

  applyBonuses (obj) {
    if (Math.random() < 0.1) {
      var index = parseInt(asafonov.bonuses.length * Math.random(), 10);
      var bonus = new asafonov.bonuses[index](this.hero, obj);
      bonus.apply();
    }
  }

  processObjectCollision (i) {
    if (this.objects[i] !== null && this.objects[i] !== undefined && this.objects[i] > 0) {
      --this.objects[i];
      asafonov.messageBus.send(asafonov.events.OBJECT_COLLISION, {index: i, type: this.objects[i]});

      if (this.objects[i] == 0) {
        --this.objectsCount;
      }
    }
  }

  correctBallPosition (obj, fromPosition) {
    if (this.checkCollision(obj)) {
      return;
    }

    if (obj.position.y >= this.height - 1 && obj.position.x >= this.hero.position.x && obj.position.x <= this.hero.position.x + this.hero.width - 1) {
      var wallType = Ball.HORIZONTAL_WALL;

      if ((this.hero.position.x == obj.position.x && obj.direction == Ball.DIRECTION_DOWNRIGHT)
      || (obj.position.x - this.hero.position.x == this.hero.width - 1 && obj.direction == Ball.DIRECTION_DOWNLEFT)) {
        obj.angle = 2;
        wallType = Ball.CORNER_WALL;
      } else if (obj.angle == 2) {
        obj.angle = Math.random() < 0.2 ? 1 : 2;
      } else if (obj.angle < 2) {
        obj.angle = Math.random() < 1.2 - obj.angle ? 1/2 : 1;
      } else {
        obj.angle = 1;
      }

      if ((obj.position.x - this.hero.position.x <= this.hero.width / 2- 1 / 2 && obj.direction == Ball.DIRECTION_DOWNRIGHT)
      || (obj.position.x - this.hero.position.x >= this.hero.width / 2 - 1 / 2 && obj.direction == Ball.DIRECTION_DOWNLEFT)) {
        wallType = Math.random() < 0.5 ? Ball.CORNER_WALL : wallType;
      }

      obj.changeDirection(wallType);
      obj.position = fromPosition;
      obj.move();
    } else if (obj.position.x < 0 || obj.position.x > this.width - 1) {
      obj.position = fromPosition;
      obj.changeDirection(Ball.VERTICAL_WALL);
      obj.move();
    } else if (obj.position.y < 0) {
      obj.position = fromPosition;
      obj.changeDirection(Ball.HORIZONTAL_WALL);
      obj.move();
    } else if (obj.position.y > this.height - 1) {
      asafonov.messageBus.send(asafonov.events.GAME_LOST, {});
    }
  }

  destroy() {
    this.hero.destroy();
    this.hero  = null;
    this.ball.destroy();
    this.ball = null;
    asafonov.messageBus.unsubscribe(asafonov.events.FIELD_HERO_MOVED, this, 'onHeroMoved');
    asafonov.messageBus.unsubscribe(asafonov.events.BALL_MOVED, this, 'onBallMoved');

    for (var i = 0; i < this.objects.length; ++i) {
      this.objects[i] = null;
    }

    this.objects.length = 0;
    console.log("Field destroy");
  }
}
class Subject {

  constructor() {
    this.position = new Point(0, 0);
    this.width = asafonov.settings.heroWidth;
    this.speed = 1;
  }

  moveLeft() {
    this.move(new Point(-1 * this.speed ,0));
  }

  moveRight() {
    this.move(new Point(1 * this.speed, 0));
  }

  moveUp() {
    this.move(new Point(0, -1 * this.speed));
  }

  moveDown() {
    this.move(new Point(0, 1 * this.speed));
  }

  move (delta) {
    this.moveTo(this.position.x + delta.x, this.position.y + delta.y);
  }

  moveTo (x, y) {
    var position = new Point(this.position.x, this.position.y);
    this.position.x = x;
    this.position.y = y;
    asafonov.messageBus.send(asafonov.events.FIELD_HERO_MOVED, {obj: this, fromPosition: position});
  }

  setWidth (width) {
    this.width = width;
    asafonov.messageBus.send(asafonov.events.HERO_WIDTH_CHANGED, {obj: this});
  }

  destroy() {
    console.log("Hero destroy");
  }
}
class HeroSpeedBonus extends AbstractBonus {
  constructor (hero, obj) {
    super(hero, obj);
    this.speed = Math.random() < 0.5 ? 3/4 : 1.5;
  }

  getMessage() {
    return "Your speed has changed";
  }

  apply() {
    this.hero.speed = this.speed;
    super.apply();
  }

  reverse() {
    this.hero.speed = 1;
  }
}
class HeroWidthBonus extends AbstractBonus {
  constructor (hero, obj) {
    super(hero, obj);
    this.width = (Math.random() < 0.5 ? -2 : 2) + asafonov.settings.heroWidth;
  }

  getMessage() {
    return "Your width has changed";
  }

  apply() {
    this.hero.setWidth(this.width);
    super.apply();
  }

  reverse() {
    this.hero.setWidth(asafonov.settings.heroWidth);
  }
}
class Levels {
  constructor (field) {
    this.levels = [];
    this.init(field);
  }

  init (field) {
    let objectMap = [];
    let iwidth = field.width / 2;
    let iheight = parseInt(field.height / 2);

    for (let i = 0; i < iheight; ++i) {
      for (let j = 0; j < field.width; ++j) {
        objectMap.push(j < field.width / 2 - iwidth / 2 || j >= field.width / 2 - iwidth / 2 + iwidth ? 0 : i % 2 + 1);
      }

      iwidth -= 2;
    }

    this.levels.push(objectMap);

    iwidth = field.width / 2;
    iheight = parseInt(field.height / 3);
    objectMap = [];

    for (let i = 0; i < iheight; ++i) {
      for (let j = 0; j < field.width; ++j) {
        objectMap.push(j < field.width / 2 - iwidth / 2 || j >= field.width / 2 - iwidth / 2 + iwidth ? i % 2 + 1 : 0);
      }

      iwidth -= 2;
    }

    this.levels.push(objectMap);

    objectMap = [];

    for (let i = 0; i < iheight; ++i) {
      for (let j = 0; j < field.width; ++j) {
        objectMap.push(j % 4 == 0 ? 1 : 0);
      }
    }

    this.levels.push(objectMap);

    objectMap = [];

    for (let i = 0; i < iheight; ++i) {
      for (let j = 0; j < field.width; ++j) {
        objectMap.push(parseInt(j / 4) % 2 == 0 ? 2 : 0);
      }
    }

    this.levels.push(objectMap);

    objectMap = [];

    for (let i = 0; i < iheight; ++i) {
      for (let j = 0; j < field.width; ++j) {
        objectMap.push(j % 4 == 0 ? 2 : 0);
      }
    }

    this.levels.push(objectMap);

    objectMap = [];

    for (let i = 0; i < iheight; ++i) {
      for (let j = 0; j < field.width; ++j) {
        objectMap.push(parseInt(j / 4) % 2 == 0 ? 1 : 0);
      }
    }

    this.levels.push(objectMap);
  }

  getRandom() {
    return this.levels[parseInt(Math.random() * this.levels.length, 10)];
  }
}
class MessageBus {

  constructor() {
    this.subscribers = {};
  }

  send (type, data) {
    if (this.subscribers[type] !== null && this.subscribers[type] !== undefined) {
      for (var i = 0; i < this.subscribers[type].length; ++i) {
        this.subscribers[type][i]['object'][this.subscribers[type][i]['func']](data);
      }
    }
  }

  subscribe (type, object, func) {
    if (this.subscribers[type] === null || this.subscribers[type] === undefined) {
      this.subscribers[type] = [];
    }

    this.subscribers[type].push({
      object: object,
      func: func
    });
  }

  unsubscribe (type, object, func) {
    for (var i = 0; i < this.subscribers[type].length; ++i) {
      if (this.subscribers[type][i].object === object && this.subscribers[type][i].func === func) {
        this.subscribers[type].slice(i, 1);
        break;
      }
    }
  }

  unsubsribeType (type) {
    delete this.subscribers[type];
  }

  destroy() {
    for (type in this.subscribers) {
      this.unsubsribeType(type);
    }

    this.subscribers = null;
  }
}
class Point {
  constructor (x, y) {
    this.x = x || 0;
    this.y = y || 0;
  }
}
class Score {

  constructor (hero, ball) {
    this.hero = hero;
    this.ball = ball;
    this.scores = 0;
    this.highscore = this.getHighScore();
    this.highscoreReported = false;
    asafonov.messageBus.subscribe(asafonov.events.OBJECT_COLLISION, this, 'onObjectCollision');
  }

  onObjectCollision (eventData) {
    this.scores += parseInt(Score.BASE_SCORE / (++eventData.type) * this.ball.angle * this.ball.speed * this.hero.speed * (this.hero.width < asafonov.settings.heroWidth ? 2 : 1) * (this.hero.width > asafonov.settings.heroWidth ? 1/2 : 1), 10);
    asafonov.messageBus.send(asafonov.events.SCORES_UPDATED, {scores: this.scores});
    this.highscore > 0 && this.isNewHighScore() && ! this.highscoreReported && (this.highscoreReported = true) && asafonov.messageBus.send(asafonov.events.NEW_HIGHSCORE, {highscore: this.scores});
  }

  getHighScore() {
    return window.localStorage.getItem('highscore') || 0;
  }

  updateHighScore() {
    window.localStorage.setItem('highscore', this.scores);
    return true;
  }

  processGameWon() {
    this.scores *= 2;
    asafonov.messageBus.send(asafonov.events.SCORES_UPDATED, {scores: this.scores});
  }

  isNewHighScore() {
    return this.scores > this.highscore;
  }
}

Score.BASE_SCORE = 8;
class BallView {

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'ball';
    asafonov.messageBus.subscribe(asafonov.events.BALL_MOVED, this, 'onBallMoved');

    if (asafonov.settings.sfx) {
      this.ballChangedDirectionSound = new Audio('sound/ball.mp3');
      asafonov.messageBus.subscribe(asafonov.events.BALL_CHANGED_DIRECTION, this, 'onBallChangedDirection');
    }
  }

  setSize (width, height) {
    this.width = width || this.width;
    this.height = height || this.height;
    const displaySize = Math.min(this.width, this.height);
    this.element.style.width = displaySize + 'px';
    this.element.style.height = displaySize + 'px';
  }

  onBallMoved (eventData) {
    var position = eventData.obj.position;
    this.element.style.marginLeft = (this.width * position.x) + 'px';
    this.element.style.marginTop = (this.height * position.y) + 'px';
  }

  onBallChangedDirection() {
    this.ballChangedDirectionSound.play();
  }

  destroy() {
    asafonov.messageBus.unsubscribe(asafonov.events.BALL_MOVED, this, 'onBallMoved');

    if (asafonov.settings.sfx) {
      asafonov.messageBus.unsubscribe(asafonov.events.BALL_CHANGED_DIRECTION, this, 'onBallChangedDirection');
    }

    console.log("BallView destroy");
  }
}
class FieldView {

  constructor() {
    this.width;
    this.height;
    this.itemWidth;
    this.itemHeight;
    this.field;
    this.element;
    this.alertElement;
    this.heroMoveInterval;
    this.onKeyDownProxy = this.onKeyDown.bind(this);
    this.onTouchProxy = this.onTouch.bind(this);
    this.hideAlertProxy = this.hideAlert.bind(this);
    this.objectCollisionSound = new Audio('sound/explosion.mp3');
    this.bonusSound = new Audio('sound/bonus.mp3');
  }

  init() {
    this.addEventListeners();
    this.initView();
    this.initAlerts();
  }

  addEventListeners() {
    asafonov.messageBus.subscribe(asafonov.events.FIELD_HERO_ADDED, this, 'onHeroAdded');
    asafonov.messageBus.subscribe(asafonov.events.FIELD_HERO_ADDED, this, 'onBallAdded');
    asafonov.messageBus.subscribe(asafonov.events.OBJECT_ADDED, this, 'onObjectAdded');
    asafonov.messageBus.subscribe(asafonov.events.OBJECT_COLLISION, this, 'onObjectCollision');
    asafonov.messageBus.subscribe(asafonov.events.GAME_LOST, this, 'onGameLost');
    asafonov.messageBus.subscribe(asafonov.events.GAME_WON, this, 'onGameWon');
    asafonov.messageBus.subscribe(asafonov.events.BONUS_APPLIED, this, 'onBonusApplied');
    asafonov.messageBus.subscribe(asafonov.events.NEW_HIGHSCORE, this, 'onNewHighscore');
    window.addEventListener('keydown', this.onKeyDownProxy);
    window.addEventListener('touchstart', this.onTouchProxy);
  }

  initView() {
    this.element = document.getElementById('field');
    this.heroView = new HeroView();
    this.initSize();
  }

  initSize() {
    this.width = this.element.offsetWidth;
    this.height = this.element.offsetHeight;
    this.itemWidth = this.width / this.field.width;
    this.itemHeight = this.height / this.field.height;
    this.heroView.setSize(this.itemWidth, this.itemHeight);
  }

  onGameLost() {
    this.gameOver("You Lost :(");
  }

  onGameWon() {
    asafonov.score.processGameWon();
    this.gameOver("You Won!");
  }

  gameOver (msg) {
    document.querySelector('#gameover').style.display = 'block';
    document.querySelector('#gameover .status').innerHTML = msg || 'Game Over';
    document.querySelector('#gameover button').focus();
    const isNewHighScore = asafonov.score.isNewHighScore();
    document.querySelector('#gameover #highscore').style.display = isNewHighScore ? 'block' : 'none';
    isNewHighScore && asafonov.score.updateHighScore() && (document.querySelector('#highscore span').innerHTML = asafonov.score.scores);
    this.destroy();
  }

  onNewHighscore() {
    this.alert("New HighScore!");
    asafonov.settings.sfx && this.bonusSound.play();
  }

  alert (msg) {
    this.alertElement.innerHTML = msg;
    this.alertElement.style.display = 'block';
    setTimeout(this.hideAlertProxy, 3000);
  }

  hideAlert() {
    this.alertElement.style.display = 'none';
  }

  initAlerts() {
    this.alertElement = document.createElement('div');
    this.alertElement.className = 'alert';
    document.body.appendChild(this.alertElement);
    this.hideAlert();
  }

  onObjectAdded (eventData) {
    if (eventData.type === null || eventData.type === undefined || eventData.type == 0) {
      return;
    }

    var element = document.createElement('div');
    element.style.marginTop = this.itemHeight * eventData.position.y + 'px';
    element.style.marginLeft = this.itemWidth * eventData.position.x + 'px';
    element.style.width = (this.itemWidth - 2) + 'px';
    element.style.height = (this.itemHeight - 2) + 'px';
    element.style.backgroundSize = this.itemWidth + 'px ' + this.itemHeight + 'px';
    element.className = 'object object_' + eventData.type;
    element.id = 'object_' + eventData.index;
    this.element.appendChild(element);
  }

  onObjectCollision (eventData) {
    var element = document.getElementById('object_' + eventData.index);
    element.className = 'object object_' + eventData.type;

    if (! (eventData.type > 0)) {
      asafonov.settings.sfx && this.objectCollisionSound.play();
      this.element.removeChild(element);
    }
  }

  onHeroAdded (eventData) {
    this.element.appendChild(this.heroView.element);
  }

  onBallAdded (eventData) {
    this.ballView = new BallView();
    this.ballView.setSize(this.itemWidth, this.itemHeight);
    this.element.appendChild(this.ballView.element);
  }

  onBonusApplied (eventData) {
    this.alert(eventData.message);
    asafonov.settings.sfx && this.bonusSound.play();
  }

  onKeyDown (e) {
    if (e.keyCode == 37) {
      this.startHeroMoving('moveLeft');
    } else if (e.keyCode == 39) {
      this.startHeroMoving('moveRight');
    }
  }

  onTouch (e) {
    e.preventDefault();
    var x = e.touches[e.touches.length - 1].clientX;

    if (x < this.element.offsetWidth / 2) {
      this.startHeroMoving('moveLeft');
    } else {
      this.startHeroMoving('moveRight');
    }
  }

  startHeroMoving (direction) {
    if (this.heroMoveInterval) {
      clearInterval(this.heroMoveInterval);
    }

    var hero = this.field.getHero();
    this.heroMoveInterval = setInterval(function() {hero[direction]();}, 60);
  }

  destroy() {
    if (this.heroMoveInterval) {
      clearInterval(this.heroMoveInterval);
    }

    this.heroView.destroy();
    this.ballView.destroy();
    this.field.destroy();
    this.heroView = null;
    this.ballView = null;
    this.field = null;
    asafonov.messageBus.unsubscribe(asafonov.events.FIELD_HERO_ADDED, this, 'onHeroAdded');
    asafonov.messageBus.unsubscribe(asafonov.events.FIELD_HERO_ADDED, this, 'onBallAdded');
    asafonov.messageBus.unsubscribe(asafonov.events.OBJECT_ADDED, this, 'onObjectAdded');
    asafonov.messageBus.unsubscribe(asafonov.events.OBJECT_COLLISION, this, 'onObjectCollision');
    asafonov.messageBus.unsubscribe(asafonov.events.GAME_LOST, this, 'onGameLost');
    asafonov.messageBus.unsubscribe(asafonov.events.GAME_WON, this, 'onGameWon');
    asafonov.messageBus.unsubscribe(asafonov.events.BONUS_APPLIED, this, 'onBonusApplied');
    asafonov.messageBus.unsubscribe(asafonov.events.NEW_HIGHSCORE, this, 'onNewHighscore');
    window.removeEventListener('keydown', this.onKeyDownProxy);
    window.removeEventListener('touchstart', this.onTouchProxy);
    console.log("FieldView destroy");
  }
}
class HeroView {

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'hero';
    this.hero = null;
    asafonov.messageBus.subscribe(asafonov.events.FIELD_HERO_ADDED, this, 'onHeroAdded');
    asafonov.messageBus.subscribe(asafonov.events.FIELD_HERO_MOVED, this, 'onHeroMoved');
    asafonov.messageBus.subscribe(asafonov.events.HERO_WIDTH_CHANGED, this, 'onHeroWidthChanged');
  }

  setSize (width, height) {
    this.width = width || this.width;
    this.height = height || this.height;

    if (this.hero === null || this.hero === undefined) {
      return ;
    }

    this.updateWidth();
  }

  updateWidth() {
    this.element.style.width = this.hero.width * this.width + 'px';
    this.element.style.height = this.height + 'px';
    this.element.style.backgroundSize = this.hero.width * this.width + 'px ' + this.height + 'px';
  }

  onHeroMoved (eventData) {
    var position = eventData.obj.position;
    this.element.style.marginLeft = (this.width * position.x) + 'px';
    this.element.style.marginTop = (this.height * position.y) + 'px';
  }

  onHeroAdded (eventData) {
    this.hero = eventData.field.getHero();
    this.setSize();
  }

  onHeroWidthChanged (eventData) {
    if (this.hero === eventData.obj) {
      this.updateWidth();
    }
  }

  destroy() {
    asafonov.messageBus.unsubscribe(asafonov.events.FIELD_HERO_ADDED, this, 'onHeroAdded');
    asafonov.messageBus.unsubscribe(asafonov.events.FIELD_HERO_MOVED, this, 'onHeroMoved');
    asafonov.messageBus.unsubscribe(asafonov.events.HERO_WIDTH_CHANGED, this, 'onHeroWidthChanged');
    console.log("HeroView destroy");
  }
}
class ScoreView {

  constructor() {
    this.element = document.querySelector('div.scores span');
    asafonov.messageBus.subscribe(asafonov.events.SCORES_UPDATED, this, 'onScoresUpdated');
  }

  onScoresUpdated (eventData) {
    this.displayScore(eventData.scores);
  }

  displayScore (score) {
    this.element.innerHTML = score;
  }

}
window.asafonov = {};
window.asafonov.messageBus = new MessageBus();
window.asafonov.events = {
  FIELD_HERO_ADDED: 'fieldHeroAdded',
  FIELD_HERO_MOVED: 'fieldHeroMoved',
  HERO_WIDTH_CHANGED: 'heroWidthChanged',
  OBJECT_ADDED: 'objectAdded',
  OBJECT_COLLISION: 'objectCollision',
  BALL_ADDED: 'ballAdded',
  BALL_MOVED: 'ballMoved',
  BALL_CHANGED_DIRECTION: 'ballChangedDirection',
  GAME_WON: 'gameWon',
  GAME_LOST: 'gameLost',
  BONUS_APPLIED: 'bonusApplied',
  SCORES_UPDATED: 'scoresUpdated',
  NEW_HIGHSCORE: 'newHighscore'
};
window.asafonov.bonuses = [HeroWidthBonus, HeroSpeedBonus, BallSpeedBonus],
window.asafonov.settings = {
  sfx: false,
  heroWidth: 5,
  ballSpeed: 1/2
}
document.addEventListener("DOMContentLoaded", function(event) { 
  const view = new FieldView();
  window.view = view;
  document.querySelector('#start button').focus();
  document.querySelector('input[name=sfx]').checked = window.localStorage.getItem('sfx') == "false" ? false : true;
  const size = window.localStorage.getItem('size');

  if (size) {
    const sizes = document.querySelectorAll('input[name=size]');

    for (let i = 0; i < sizes.length; ++i) {
      sizes[i].value == size && (sizes[i].checked = true);
    }
  }
});

function start() {
  document.getElementById('start').style.display = 'none';
  asafonov.settings.sfx = document.querySelector('input[name=sfx]').checked;
  asafonov.settings.sfx && (new Audio('sound/ball.mp3')).play();
  window.localStorage.setItem('size', document.querySelector('input[name=size]:checked').value);
  window.localStorage.setItem('sfx', asafonov.settings.sfx);

  // views and models
  const size = document.querySelector('input[name=size]:checked').value.split('x');
  window.view.field = new Field(size[0], size[1]);
  window.view.init();
  const hero = new Subject();
  window.view.field.setHero(hero);
  const ball = new Ball();
  window.view.field.setBall(ball);
  const levels = new Levels(window.view.field);
  window.view.field.setObjectMap(levels.getRandom());
  asafonov.score = new Score(hero, ball);
  const scoreView = new ScoreView();
}
