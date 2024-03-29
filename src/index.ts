import Rect from './shape/Rect';
import Polygon from './shape/Polygon';
import Dot from './shape/Dot';
import { Point } from './Types';
import EventBus from './EventBus';

export default class CanvasToMark extends EventBus {
    lock: boolean = false // 只读模式

    MIN_WIDTH: number = 10

    MIN_HEIGHT: number = 10

    strokeStyle = 'rgb(0, 0, 255)'

    fillStyle = 'rgba(0, 0, 255,0.1)'

    activeStrokeStyle = '#f00'

    ctrlFillStyle = '#fff'

    ctrlRadius = 5 // 控制点半径

    pointRadius = 5 // 圆半径

    labelFillStyle = '#fff'

    labelFontSize = 12

    labelFontColor = '#000'

    labelMaxLen = 5

    rollScal: boolean = true; // 滚轮缩放

    WIDTH: number

    HEIGHT: number

    canvas: HTMLCanvasElement

    ctx: CanvasRenderingContext2D

    dataset: Array<Rect | Polygon | Dot> = []

    offlineCanvas: HTMLCanvasElement

    offlineCtx: CanvasRenderingContext2D

    remmber: number[][] // 记录锚点距离

    movePoint: Point // 记录鼠标位置

    remmberOrigin: number[] = [0, 0] // 记录背景图鼠标位移

    createType: number = 0 // 0 不创建，1 创建矩形，2 创建多边形，3 创建点

    ctrlIndex: number = -1

    image: HTMLImageElement = new Image()

    imageLoaded: false

    IMAGE_ORIGIN_WIDTH: number;

    IMAGE_WIDTH: number;

    IMAGE_ORIGIN_HEIGHT: number;

    IMAGE_HEIGHT: number;

    originX: number = 0; // 原点x

    originY: number = 0; // 原点y

    scaleStep: number = 0; // 缩放步长

    zoomCenter: 'canvasCenter' | 'mouse' = 'canvasCenter'; // 缩放中心 canvasCenter画布中心 mouse鼠标

    canStart: Promise<any>

    constructor(el: HTMLCanvasElement | string, imgSrc?: string) {
        super()
        const container = typeof el === 'string' ? document.querySelector(el) : el;
        if (Object.prototype.toString.call(container).includes('HTMLCanvasElement')) {
            this.canvas = container as HTMLCanvasElement;
            this.ctx = this.canvas.getContext('2d');
            this.WIDTH = this.canvas.clientWidth;
            this.HEIGHT = this.canvas.clientHeight;
            this.offlineCanvas = document.createElement('canvas');
            this.offlineCanvas.width = this.WIDTH;
            this.offlineCanvas.height = this.HEIGHT;
            this.offlineCtx = this.offlineCanvas.getContext('2d');
            this.initScreen();
            if (imgSrc) {
                this.setImage(imgSrc)
            }
        } else {
            console.warn('HTMLCanvasElement is required!');
        }
    }

    get activeShape() {
        return this.dataset.find(x => x.active);
    }

    get scale() {
        if (this.IMAGE_ORIGIN_WIDTH && this.IMAGE_WIDTH) {
            return this.IMAGE_WIDTH / this.IMAGE_ORIGIN_WIDTH;
        }
        return 1;
    }
    /**
     * 初始化
     */
    initScreen() {
        this.canvas.style.userSelect = 'none';
        this.canStart = new Promise((resolve) => {
            if (this.imageLoaded) {
                resolve(true)
            } else {
                this.image.addEventListener('load', () => {
                    this.emit('load');
                    this.IMAGE_ORIGIN_WIDTH = this.IMAGE_WIDTH = this.image.width;
                    this.IMAGE_ORIGIN_HEIGHT = this.IMAGE_HEIGHT = this.image.height;
                    this.fitZoom();
                    resolve(true)
                });
            }
        })

        this.canvas.addEventListener('contextmenu', (e) => {
            if (this.lock) return;
            e.preventDefault();
        });
        this.canvas.addEventListener('mousewheel', (e: WheelEvent) => {
            if (this.lock || !this.rollScal) return;
            e.preventDefault();
            this.setScale(e.deltaY < 0,e);
            const offsetX = Math.round(e.offsetX / this.scale);
            const offsetY = Math.round(e.offsetY / this.scale);
            this.movePoint = [offsetX, offsetY];
            this.update()
        });

        this.canvas.addEventListener('mousedown', (e: MouseEvent) => {
            if (this.lock) return;
            // 计算点击位置距原图（缩放前）原点距离
            const offsetX = Math.round(e.offsetX / this.scale);
            const offsetY = Math.round(e.offsetY / this.scale);
            const mousePoint: Point = [e.offsetX, e.offsetY];

            if (e.buttons === 2) { // 鼠标右键
                this.remmberOrigin = [e.offsetX - this.originX, e.offsetY - this.originY];
            } else if (e.buttons === 1) { // 鼠标左键
                // 点击到控制点
                // 获取所有控制点
                // @ts-ignore
                const ctrls = this.activeShape?.ctrlsData || [];

                // 判断点击位置是否在标记点内
                this.ctrlIndex = ctrls.findIndex((coor: Point) => this.isPointInCircle(mousePoint, coor, this.ctrlRadius));
                if (this.ctrlIndex > -1) {
                    const [x0, y0] = ctrls[this.ctrlIndex];
                    this.remmber = [[offsetX - x0, offsetY - y0]];
                    return;
                }
                // 是否点击到形状
                const [hitShapeIndex, hitShape] = this.hitOnShape(mousePoint);
                // 是否正在创建多边形
                const oncreating = this.activeShape?.type === 2 && this.activeShape.creating;
                if (oncreating) {
                    // 正在创建多边形
                    // 多边形新增点
                    if (this.isInBackground(e)) {
                        const pShape = this.activeShape as Polygon;
                        const [x, y] = pShape.coor[pShape.coor.length - 1];
                        if (x !== offsetX && y !== offsetY) {
                            const nx = Math.round(offsetX - this.originX / this.scale)
                            const ny = Math.round(offsetY - this.originY / this.scale)
                            pShape.coor.push([nx, ny]);
                            this.update();
                        }
                    }
                } else if (hitShapeIndex > -1) {
                    // 点击位置在标注内
                    // 触发监听事件
                    this.emit('select', hitShape)
                    this.dataset.forEach((item, i) => {
                        // js对象引用类型，直接修改了item本身，标记为激活状态
                        item.active = i === hitShapeIndex;
                    });
                    hitShape.dragging = true;
                    // 删除原来标记
                    this.dataset.splice(hitShapeIndex, 1);
                    // 重新push修改属性后的标记
                    this.dataset.push(hitShape);
                    this.remmber = [];
                    // 如果是点
                    if (hitShape.type === 3) {
                        const [x, y] = hitShape.coor;
                        this.remmber = [[offsetX - x, offsetY - y]];
                    } else {
                        // 不是点
                        hitShape.coor.forEach((pt: any) => {
                            this.remmber.push([offsetX - pt[0], offsetY - pt[1]]);
                        });
                    }
                    this.update();
                } else if (this.createType > 0 && this.isInBackground(e)) {
                    // 创建矩形/多边形
                    let newShape;
                    const nx = Math.round(offsetX - this.originX / this.scale)
                    const ny = Math.round(offsetY - this.originY / this.scale)
                    // 点击位置相对原图原点
                    const curPoint: Point = [nx, ny];
                    if (this.createType === 1) {
                        newShape = new Rect([curPoint, curPoint], this.dataset.length);
                        newShape.creating = true;
                    } else if (this.createType === 2) {
                        newShape = new Polygon([curPoint], this.dataset.length);
                        newShape.creating = true;
                    } else if (this.createType === 3) {
                        newShape = new Dot(curPoint, this.dataset.length);
                        this.emit('add', newShape)
                    }
                    this.dataset.forEach((sp) => { sp.active = false; });
                    newShape.active = true;
                    this.dataset.push(newShape);
                    this.emit('updated', newShape)
                    this.update();
                } else if (this.activeShape) {
                    this.activeShape.active = false;
                    this.update();
                }
            }
        });
        this.canvas.addEventListener('mousemove', (e: MouseEvent) => {
            if (this.lock) return;
            const offsetX = Math.round(e.offsetX / this.scale);
            const offsetY = Math.round(e.offsetY / this.scale);
            // 记录鼠标位置
            this.movePoint = [offsetX, offsetY];
            if (e.buttons === 2 && e.which === 3) {
                // 拖动背景
                this.originX = Math.round(e.offsetX - this.remmberOrigin[0]);
                this.originY = Math.round(e.offsetY - this.remmberOrigin[1]);
                this.update();

            } else if (e.buttons === 1 && this.activeShape) {
                if (this.ctrlIndex > -1 && this.isInBackground(e)) {
                    const [[x, y]] = this.remmber;
                    // resize矩形
                    if (this.activeShape.type === 1) {
                        const [[x0, y0], [x1, y1]] = (this.activeShape as Rect).coor;
                        let coor: Point[] = [];
                        switch (this.ctrlIndex) {
                            case 0:
                                coor = [[offsetX - x, offsetY - y], [x1, y1]];
                                break;
                            case 1:
                                coor = [[x0, offsetY - y], [x1, y1]];
                                break;
                            case 2:
                                coor = [[x0, offsetY - y], [offsetX - x, y1]];
                                break;
                            case 3:
                                coor = [[x0, y0], [offsetX - x, y1]];
                                break;
                            case 4:
                                coor = [[x0, y0], [offsetX - x, offsetY - y]];
                                break;
                            case 5:
                                coor = [[x0, y0], [x1, offsetY - y]];
                                break;
                            case 6:
                                coor = [[offsetX - x, y0], [x1, offsetY - y]];
                                break;
                            case 7:
                                coor = [[offsetX - x, y0], [x1, y1]];
                                break;
                            default:
                                break;
                        }
                        const [[a0, b0], [a1, b1]] = coor;
                        if ((a1 - a0) >= this.MIN_WIDTH && (b1 - b0) >= this.MIN_HEIGHT) {
                            this.activeShape.coor = coor;
                        } else {
                            this.emit('error', `宽不能小于${this.MIN_WIDTH},高不能小于${this.MIN_HEIGHT}。`);
                        }
                    } else if (this.activeShape.type === 2) {
                        const nx = Math.round(offsetX - this.originX / this.scale)
                        const ny = Math.round(offsetY - this.originY / this.scale)
                        const newPoint = [nx, ny]
                        this.activeShape.coor.splice(this.ctrlIndex, 1, newPoint);
                    }
                } else if (this.activeShape.dragging) { // 拖拽
                    let coor = [];
                    let noLimit = true
                    const w = this.IMAGE_ORIGIN_WIDTH || this.WIDTH;
                    const h = this.IMAGE_ORIGIN_HEIGHT || this.HEIGHT;
                    if (this.activeShape.type === 3) {
                        const [t1, t2] = this.remmber[0];
                        const x = offsetX - t1;
                        const y = offsetY - t2;
                        if (x < 0 || x > w || y < 0 || y > h) noLimit = false;
                        coor = [x, y];
                    } else {
                        for (let i = 0; i < this.activeShape.coor.length; i++) {
                            const tar = this.remmber[i];
                            const x = offsetX - tar[0];
                            const y = offsetY - tar[1];
                            if (x < 0 || x > w || y < 0 || y > h) noLimit = false
                            coor.push([x, y]);
                        }
                    }
                    if (noLimit) this.activeShape.coor = coor;
                } else if (this.activeShape.creating && this.activeShape.type === 1 && this.isInBackground(e)) {
                    // 创建矩形
                    const x = Math.round(offsetX - this.originX / this.scale);
                    const y = Math.round(offsetY - this.originY / this.scale);
                    this.activeShape.coor.splice(1, 1, [x, y]);
                }
                this.emit('updated', this.activeShape)
                this.update();
            } else if (this.activeShape?.type === 2 && (this.activeShape as Polygon)?.creating) {
                // 多边形添加点
                this.update();
            }
        });
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.lock) return;
            this.remmber = [];
            if (this.activeShape) {
                this.activeShape.dragging = false;
                if (this.activeShape.creating && this.activeShape.type === 1) {
                    const [[x0, y0], [x1, y1]] = this.activeShape.coor;
                    if (Math.abs(x0 - x1) < this.MIN_WIDTH || Math.abs(y0 - y1) < this.MIN_HEIGHT) {
                        this.dataset.pop();
                        this.emit('error', `宽不能小于${this.MIN_WIDTH},高不能小于${this.MIN_HEIGHT}`);
                    } else {
                        this.activeShape.coor = [[Math.min(x0, x1), Math.min(y0, y1)], [Math.max(x0, x1), Math.max(y0, y1)]];
                        this.activeShape.creating = false;
                        this.emit('add', this.activeShape);
                    }
                    this.update();
                }
            }
        });

        this.canvas.addEventListener('dblclick', () => {
            if (this.lock) return;
            if (this.activeShape?.type === 2) {
                if (this.activeShape.coor.length > 2) {
                    this.emit('add', this.activeShape);
                    this.emit('updated', this.activeShape);
                    this.activeShape.creating = false;
                    this.update();
                }
            }
        });
        document.body.addEventListener('keyup', (e: KeyboardEvent) => {
            if (this.lock) return;
            if( ['Escape','Backspace'].includes(e.key) && this.activeShape){
                this.deleteByIndex(this.activeShape.index);
            }
        });
    }
    /**
     * 添加/切换图片
     * @param url 图片链接
     */
    setImage(url: string) {
        this.imageLoaded = false
        this.image.src = url
    }
    /**
     * 设置数据
     * @param data Array
     */
    async setData(data: any[]) {
        let initdata: any[] = []
        try {
            await this.canStart
            data.forEach((item, index) => {
                if (Object.prototype.toString.call(item).indexOf('Object') > -1) {
                    const { label, type, coor, strokeStyle, fillStyle, labelFillStyle, uuid } = item;
                    const style = { strokeStyle, fillStyle, labelFillStyle }
                    let shape
                    switch (type) {
                        case 1:
                            shape = new Rect(coor, index, label, style, uuid);
                            break;
                        case 2:
                            shape = new Polygon(coor, index, label, style, uuid);
                            break;
                        case 3:
                            shape = new Dot(coor, index, label, style, uuid);
                            break;
                        default:
                            break;
                    }
                    initdata.push(shape);
                } else {
                    this.emit('error', `${item} in data must be an enumerable Object.`);
                }
            });
            this.dataset = initdata
            this.update();
        } catch (error) {
            this.emit('error', error);
        }
    }
    /**
     * 判断是否在标注实例上
     * @param mousePoint 点击位置
     * @returns
     */
    hitOnShape(mousePoint: Point): [number, Rect | Polygon | Dot] {
        let hitShapeIndex = -1;
        const hitShape = this.dataset.reduceRight((target, shape, i) => {
            if (!target) {
                if (
                    (shape.type === 3 && this.isPointInCircle(mousePoint, shape.coor as Point, this.pointRadius))
                    || (shape.type === 1 && this.isPointInRect(mousePoint, (shape as Rect).coor))
                    || (shape.type === 2 && this.isPointInPolygon(mousePoint, (shape as Polygon).coor))
                ) {
                    hitShapeIndex = i;
                    target = shape;
                }
            }
            return target;
        }, null);
        return [hitShapeIndex, hitShape];
    }

    /**
     * 判断鼠标是否在背景图内部
     * @param e MouseEvent
     * @returns 布尔值
     */
    isInBackground(e: MouseEvent): boolean {
        const offsetX = e.offsetX / this.scale;
        const offsetY = e.offsetY / this.scale;
        return offsetX >= this.originX / this.scale && offsetY >= this.originY / this.scale
            && offsetX <= this.originX / this.scale + this.IMAGE_ORIGIN_WIDTH && offsetY <= this.originY / this.scale + this.IMAGE_ORIGIN_HEIGHT;
    }
    /**
     * 判断是否在矩形内
     * @param point 坐标
     * @param coor 区域坐标
     * @returns 布尔值
     */
    isPointInRect(point: Point, coor: Point[]): boolean {
        const [x, y] = point;
        const [[x0, y0], [x1, y1]] = coor.map((a) => a.map((b) => b * this.scale));
        return x0 + this.originX <= x && x <= x1 + this.originX && y0 + this.originY <= y && y <= y1 + this.originY;
    }
    /**
     * 判断是否在多边形内
     * @param point 坐标
     * @param coor 区域坐标
     * @returns 布尔值
     */
    isPointInPolygon(point: Point, coor: Point[]): boolean {
        this.offlineCtx.save();
        this.offlineCtx.clearRect(0, 0, this.WIDTH, this.HEIGHT);
        this.offlineCtx.translate(this.originX, this.originY);
        this.offlineCtx.beginPath();
        coor.forEach((pt, i) => {
            const [x, y] = pt.map((a) => Math.round(a * this.scale));
            if (i === 0) {
                this.offlineCtx.moveTo(x, y);
            } else {
                this.offlineCtx.lineTo(x, y);
            }
        });
        this.offlineCtx.closePath();
        this.offlineCtx.fill();
        const areaData = this.offlineCtx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
        const index = (point[1] - 1) * this.WIDTH * 4 + point[0] * 4;
        this.offlineCtx.restore();
        return areaData.data[index + 3] !== 0;
    }
    /**
     * 判断是否在圆内
     * @param point 坐标
     * @param center 圆心
     * @param r 半径
     * @returns 布尔值
     */
    isPointInCircle(point: Point, center: Point, r: number): boolean {
        const [x, y] = point;
        const [x0, y0] = center.map((a) => a * this.scale);
        const distance = Math.sqrt((x0 - (x - this.originX)) ** 2 + (y0  - (y - this.originY)) ** 2);
        return distance <= r;
    }
    /**
     * 绘制矩形
     * @param shape 标注实例
     * @returns
     */
    drawRect(shape: Rect) {
        if (shape.coor.length !== 2) return;
        const { labelFillStyle, strokeStyle, fillStyle, active, creating, coor, label } = shape
        const [[x0, y0], [x1, y1]] = coor.map((a: Point) => a.map((b) => Math.round(b * this.scale)));
        this.ctx.save();
        this.ctx.fillStyle = fillStyle || this.fillStyle;
        this.ctx.strokeStyle = (active || creating) ? this.activeStrokeStyle : (strokeStyle || this.strokeStyle);
        const w = x1 - x0;
        const h = y1 - y0;
        this.ctx.strokeRect(x0, y0, w, h);
        if (!creating) this.ctx.fillRect(x0, y0, w, h);
        this.ctx.restore();
        const labelCoor: Point = [coor[0][0] + ((coor[1][0] - coor[0][0]) / 2)  , coor[0][1] + ((coor[1][1] - coor[0][1]) / 2)]

        this.drawLabel(labelCoor, label, labelFillStyle);
    }
    /**
     * 绘制多边形
     * @param shape 标注实例
     */
    drawPolygon(shape: Polygon) {
        const { labelFillStyle, strokeStyle, fillStyle, active, creating, coor, label } = shape
        this.ctx.save();
        this.ctx.fillStyle = fillStyle || this.fillStyle;
        this.ctx.strokeStyle = (active || creating) ? this.activeStrokeStyle : (strokeStyle || this.strokeStyle);
        this.ctx.beginPath();
        coor.forEach((el: Point, i) => {
            const [x, y] = el.map((a) => Math.round(a * this.scale));
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        if (creating) {
            const [x, y] = this.movePoint.map((a) => Math.round(a * this.scale));
            this.ctx.lineTo(x - this.originX, y - this.originY);
        } else if (coor.length > 2) {
            this.ctx.closePath();
        }
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
        this.drawLabel(coor[0], label, labelFillStyle);
    }
    /**
     * 绘制点
     * @param shape 标注实例
     */
    drawDot(shape: Dot) {
        const { labelFillStyle, strokeStyle, fillStyle, active, coor, label } = shape
        const [x, y] = coor.map((a) => a * this.scale);
        this.ctx.save();
        this.ctx.fillStyle = fillStyle || this.ctrlFillStyle;
        this.ctx.strokeStyle = active ? this.activeStrokeStyle : (strokeStyle || this.strokeStyle);
        this.ctx.beginPath();
        this.ctx.arc(x, y, this.pointRadius, 0, 2 * Math.PI, true);
        // 通过填充路径的内容区域生成实心的图形
        this.ctx.fill();
        this.ctx.arc(x, y, this.pointRadius, 0, 2 * Math.PI, true);
        // 通过线条来绘制图形轮廓
        this.ctx.stroke();
        this.ctx.restore();
        const labelCoor = [coor[0]  , coor[1] + (this.pointRadius + 2) * 1/this.scale]
        this.drawLabel(labelCoor as Point, label, labelFillStyle);
    }
    /**
     * 绘制控制点
     * @param point 坐标
     */
    drawCtrl(point: Point) {
        const [x, y] = point.map((a) => a * this.scale);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = 'rgb(52,244,39)';
        this.ctx.arc(x, y, this.ctrlRadius, 0, 2 * Math.PI, true);
        this.ctx.fill();
        this.ctx.arc(x, y, this.ctrlRadius, 0, 2 * Math.PI, true);
        this.ctx.stroke();
        this.ctx.restore();
    }
    /**
     * 绘制控制点列表
     * @param shape 标注实例
     */
    drawCtrlList(shape: Rect | Polygon) {
        shape.ctrlsData.forEach((point) => {
            this.drawCtrl(point);
        });
    }
    /**
     * 绘制label
     * @param point 位置
     * @param label 文本
     */
    drawLabel(point: Point, label: string = '', labelFillStyle = '') {
        if (label.length) {
            const newStr = label.length < this.labelMaxLen + 1 ? label : (`${label.substr(0, this.labelMaxLen)}...`);
            this.ctx.font =`${this.labelFontSize}px 楷体`;
            const text = this.ctx.measureText(newStr);
            const [x, y] = point.map((a) => a * this.scale);
            this.ctx.save();
            this.ctx.fillStyle = labelFillStyle || this.labelFillStyle;
            this.ctx.fillRect(x - ((text.width + 8)/2), y, text.width + 8, this.labelFontSize*1.3);
            this.ctx.fillStyle = this.labelFontColor;
            this.ctx.fillText(newStr, x-((text.width + 4)/2), y +  (this.labelFontSize));
            this.ctx.restore();
        }
    }
    //
    /**
     * 绘制背景图片
     */
    paintImage() {
        this.ctx.drawImage(this.image, 0, 0, this.IMAGE_WIDTH, this.IMAGE_HEIGHT);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.WIDTH, this.HEIGHT);
    }

    /**
     * 更新画布
     */
    update() {
        this.ctx.save();
        this.clear();
        this.ctx.translate(this.originX, this.originY);
        this.paintImage();
        this.dataset.forEach((shape) => {
            switch (shape.type) {
                case 1:
                    this.drawRect(shape as Rect);
                    break;
                case 2:
                    this.drawPolygon(shape as Polygon);
                    break;
                case 3:
                    this.drawDot(shape as Dot);
                    break;
                default:
                    break;
            }
        });
        if (this.activeShape && [1, 2].includes(this.activeShape.type)) {
            this.drawCtrlList(this.activeShape as Rect | Polygon);
        }
        this.ctx.restore();
    }

    /**
     * 删除指定实例
     * @param index number
     */
    deleteByIndex(index: number) {
        const num = this.dataset.findIndex((x) => x.index === index);
        if (num > -1) {
            this.emit('delete', this.dataset[num]);
            this.dataset.splice(num, 1);
            this.dataset.forEach((item, i) => { item.index = i; });
            this.update();
        }
    }

    /**
     * 计算缩放步长
     * @param init 是否为init
     */
    calcStep(init?: boolean) {
        if (init) {
            this.scaleStep = 100;
            this.setScale(false);
        }
        if (this.IMAGE_WIDTH > this.WIDTH || this.IMAGE_HEIGHT > this.HEIGHT) {
            this.setScale(false);
            this.calcStep();
        }
    }

    /**
     * 缩放
     * @param type true放大，false，缩小
     * @param e 事件对象
     */
    setScale(type: boolean, e?:MouseEvent) {
        const ratio = (type ? 1.05 : 0.95)
        this.IMAGE_WIDTH = this.IMAGE_WIDTH * ratio;
        this.IMAGE_HEIGHT = this.IMAGE_HEIGHT * ratio;

        if(this.zoomCenter === 'mouse' && e){
            // 以鼠标位置为中心，进行缩放
            const containerPosition = this.getElementTop(this.canvas)

            const newOffsetX = ratio * ((e.clientX-containerPosition.pageLeft) - this.originX);
            const newOffsetY = ratio * ((e.clientY-containerPosition.pageTop) - this.originY);

            this.originX = this.originX + ((e.clientX-containerPosition.pageLeft) - this.originX) - newOffsetX
            this.originY = this.originY + ((e.clientY-containerPosition.pageTop) - this.originY) - newOffsetY
        }else {
            // 以画布为中心，进行缩放
            this.originX = (this.WIDTH  - this.IMAGE_WIDTH) / 2;
            this.originY = (this.HEIGHT  - this.IMAGE_HEIGHT) / 2;
        }
        this.update();
    }


    /**
     * 适配背景图
     */
    fitZoom() {
        this.calcStep(true);
        if (this.IMAGE_HEIGHT / this.IMAGE_WIDTH >= this.HEIGHT / this.WIDTH) {
            this.IMAGE_WIDTH = this.IMAGE_ORIGIN_WIDTH / (this.IMAGE_ORIGIN_HEIGHT / this.HEIGHT);
            this.IMAGE_HEIGHT = this.HEIGHT;
        } else {
            this.IMAGE_WIDTH = this.WIDTH;
            this.IMAGE_HEIGHT = this.IMAGE_ORIGIN_HEIGHT / (this.IMAGE_ORIGIN_WIDTH / this.WIDTH);
        }
        this.originX = (this.WIDTH - this.IMAGE_WIDTH) / 2;
        this.originY = (this.HEIGHT - this.IMAGE_HEIGHT) / 2;
        this.update();
    }

    /**
     * 获取dom距离页面顶部、左侧距离
     */
    getElementTop(elem: HTMLElement){
        let elemTop = elem.offsetTop;//获得elem元素距相对定位的父元素的top
        let elemLeft = elem.offsetLeft;//获得elem元素距相对定位的父元素的top

        let e: any =elem.offsetParent;//将elem换成起相对定位的父元素
        while(e!=null){//只要还有相对定位的父元素
            //获得父元素 距他父元素的top值,累加到结果中
            elemTop+=e.offsetTop;
            elemLeft += e.offsetLeft;
            //再次将elem换成他相对定位的父元素上;
            e=e.offsetParent;
        }
        return {pageLeft:elemLeft,pageTop:elemTop};
    }
}
