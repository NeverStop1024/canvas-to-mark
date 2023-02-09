# canvas-to-mark

canvas图片标注工具  

[demo](https://codesandbox.io/s/throbbing-dust-tyn5wk?file=/index.html) | [效果](https://tyn5wk.csb.app/)

![example_lhizmZ](https://cdn.jsdelivr.net/gh/NeverStop1024/images-store@main/blog/example_lhizmZ.png)

## 简介

- 支持矩形标注、多边形标注、点标注。

- 支持拖拽、缩放。

- 支持控制点编辑。

- 支持全局样式设置，单个形状样式设置。

- 支持添加、编辑标签。

- 每个形状有唯一 uuid，没有则自动生成。

## 1、使用

- 设置 instance.createType 指定需要创建形状类型。

- 创建矩形时，按住鼠标左键拖动完成创建。

- 创建多边形时，鼠标左键单击添加点，双击闭合完成创建，`Escape`退出创建，`Backspace`退一步删除选择点。

- 按住鼠标右键拖动画布。

- 鼠标滚轮缩放画布。

- 选中形状，`Backspace`删除

- 通过 instance.dataset 查看标注结果

支持 UMD 模块规范

```
npm i canvas-to-mark
```

## 1、实例属性

对任意属性的修改都需要调用`instance.update()`更新视图

| 属性名称          |   类型    |         默认值         | 单个形状属性修改 |     说明     |
| ----------------- |:-------:|:-------------------:| :--------------: |:----------:|
| lock              | boolean |        false        |                  |   是否锁定画布   |
| MIN_WIDTH         | number  |         10          |                  |   最小矩形宽度   |
| MIN_HEIGHT        | number  |         10          |                  |   最小矩形高度   |
| strokeStyle       | string  |   rgb(0, 0, 255)    |       支持       |   形状边线颜色   |
| fillStyle         | string  | rgba(0, 0, 255,0.1) |       支持       |   形状填充颜色   |
| activeStrokeStyle | string  |        #f00         |                  | 选中的形状边线颜色  |
| ctrlFillStyle     | string  |        #fff         |                  |  控制点填充颜色   |
| ctrlRadius        | number  |          5          |                  |   控制点半径    |
| pointRadius        | number  |          5          |                  |    圆半径     |
| labelFillStyle    | string  |        #fff         |       支持       | label 填充颜色 |
| labelFontSize        | number  |          12          |                  | label文字大小  |
| labelFontColor    | string  |        #000         |       支持       | label 文字颜色 |
| labelMaxLen       | number  |          5          |                  |    label 字符最大显示个数，超出字符将用...表示    |
| rollScal          | boolean | true  |                  |             是否允许滚轮缩放             |
| createType        | boolean |   0   |                  |    0 不创建，1 创建矩形，2 创建多边形，3 点标注    |
| zoomCenter          | String  | canvasCenter  |                  | 缩放中心（canvasCenter 画布中心，mouse 鼠标） |

## 2、实例方法

| 方法名称      | 参数类型 |                 说明                  |
| ------------- | :------: | :-----------------------------------: |
| setImage      |  string  |             添加/切换图片             |
| setData       |  Array   |             加载初始数据              |
| setScale      | boolean  |     true 放大画布，false 缩小画布     |
| fitZoom       |    无    |      适配图片到画布 （contain）       |
| update        |    无    | 更新画布， 修改实例属性后要执行此方法 |
| deleteByIndex |  number  |           根据索引删除形状            |

## 3、事件

| 事件名称 | 回调参数 |        说明        |
| -------- | :------: | :----------------: |
| select   |   info   |   当前选中的数据   |
| add      |   info   |   当前添加的数据   |
| delete   |   info   |   当前删除的数据   |
| updated  |   info   | 发生变化的形状数据 |
| load     |    无    |    图片加载完成    |
| error    |  error   |      错误信息      |


## 注释
本项在[canvas-select](https://github.com/heylight/canvas-select)基础上做了些改动，感谢原作者🙏
