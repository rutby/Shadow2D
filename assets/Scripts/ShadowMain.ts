import ShadowUtils from "./Utils";

interface IShadowBorderPoint {
    pos: cc.Vec2,
    degree?: number,
    posIndex?: number,
    segIndex?: number,
}

interface IShadowKeyPoint {
    pos: cc.Vec2,
    isBorder?: boolean,
    dis?: number,
    isSourceSegment?: boolean,
}

const {ccclass, property, menu} = cc._decorator;

@ccclass
@menu("Demo/Shadow/ShadowMain")
export default class ShadowMain extends cc.Component {
    @property(cc.Mask) nodeMaskDark: cc.Mask = null;
    @property(cc.Mask) nodeMaskLight: cc.Mask = null;
	@property(cc.Node) nodeBlock: cc.Node = null;
    @property(cc.Node) nodePlayer: cc.Node = null;

    mSegments: any[] = [];
    mStaticCorner: cc.Vec2[] = [];

    //================================================ cc.Component
    onLoad() {
        CC_PREVIEW && cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onEventKeyDown, this);
        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this);

        var winSize = cc.director.getWinSize();
        this.mStaticCorner = [
            cc.v2(winSize.width/2, winSize.height/2),
            cc.v2(-winSize.width/2, winSize.height/2),
            cc.v2(-winSize.width/2, -winSize.height/2),
            cc.v2(winSize.width/2, -winSize.height/2),
        ];

		this.nodeBlock.children.forEach(ele => {
			if (ele.active) {
				var points = ele.getComponent(cc.PolygonCollider).points;
				var p1 = points[0];
                var p2 = points[1];
                var a = cc.pAdd(p1, ele.position);
                var b = cc.pAdd(p2, ele.position);
				this.mSegments.push([a, b]);
			}
        })
	}
	
	onDestroy() {
		CC_PREVIEW && cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onEventKeyDown, this);
    }

    update() {
        this.step();
    }

    //================================================ Private
    private isCameraEnabled() {
        return !!cc.find('Canvas/node_camera');
    }

    private getCornerPoints(): IShadowBorderPoint[] {
        var points = [];
        var cameraEnabled = this.isCameraEnabled();
        var posCenter = this.nodePlayer.position;
        this.mStaticCorner.forEach(ele => {
            points.push({pos: cameraEnabled? cc.pAdd(posCenter, ele) : ele, degree: 0});
        });
        return points;
    }

	private step() {
        var posCenter = this.nodePlayer.position;
        var cornerPoints = this.getCornerPoints();
       
        // 计算四个边角的角度值
		cornerPoints.forEach(ele => {
            ele.degree = ShadowUtils.getAngleForMath(posCenter, ele.pos);
        });

        // 边角的顶点自动纳入边界点数组
        var borderPoints: IShadowBorderPoint[] = [].concat(cornerPoints);

        // 当阻挡线段与屏幕边界相交时, 将其交点纳入边界点数组
        this.mSegments.forEach((seg, segIndex) => {
            cornerPoints.forEach((border, borderIndex) => {
                var p1 = cornerPoints[borderIndex];
                var p2 = cornerPoints[(borderIndex + 1) % cornerPoints.length];
                if (cc.pSegmentIntersect(seg[0], seg[1], p1.pos, p2.pos)) {
                    borderPoints.push({pos: cc.pIntersectPoint(seg[0], seg[1], p1.pos, p2.pos)});
                }
            })
        });

		// 以当前中心点为起点, 向每个阻挡线段的顶点发射射线, 取其与屏幕边界的交点
		this.mSegments.forEach((seg, segIndex) => {
			seg.forEach((pos, posIndex) => {
				var degree = ShadowUtils.getAngleForMath(posCenter, pos);
				var border = this.getSegBorder(cornerPoints, degree);
				var a = posCenter;
				var b = pos;
				var c = cornerPoints[border[0]].pos;
                var d = cornerPoints[border[1]].pos;
                var posIntersect = cc.pIntersectPoint(a, b, c, d);
                // 这里需要记录阻挡线段的顶点, 因为浮点数的精度性, 射线AB相交线段CD于E, B却未必在线段AE上
                borderPoints.push({posIndex: posIndex, segIndex: segIndex, pos: posIntersect});
			});
        });

        var keyPoints: IShadowKeyPoint[] = [];
		// 取边界上的所有交点与当前中心点组成的所有线段, 与最近的阻挡线段的交点
		borderPoints.forEach(posBorder => {
            var pool: IShadowKeyPoint[] = [];

            this.mSegments.forEach((ele, segIndex) => {
                var ele = this.mSegments[segIndex];
                var posIntersect = null;
                var isSourceSegment = posBorder.segIndex == segIndex; 

                // 如果是原阻挡线段, 则向线段中心点缩进一小部分, 以避开顶点排序问题 - @1
                if (isSourceSegment) {
                    var segFactor = posBorder.posIndex == 0? 0.01 : 0.99;
                    posIntersect = cc.pLerp(ele[0], ele[1], segFactor);
                } else {
                    if (cc.pSegmentIntersect(posCenter, posBorder.pos, ele[0], ele[1])) {
                        posIntersect = cc.pIntersectPoint(posCenter, posBorder.pos, ele[0], ele[1]);
                    }
                }

                if (posIntersect) {
                    var dis = cc.pDistanceSQ(posCenter, posIntersect);
                    pool.push({dis: dis, pos: posIntersect, isSourceSegment: isSourceSegment});
                }
            })

            pool.sort((a, b) => {
                return a.dis - b.dis;
            })

            // 当最近交点是阻挡线段的边界点时, 向后额外取一个交点
            if (pool.length > 0) {
                keyPoints.push(pool[0]);
                pool[0].isSourceSegment && keyPoints.push(pool[1] || {isBorder: true, pos: posBorder.pos});
            } else {
                keyPoints.push({isBorder: true, pos: posBorder.pos});
            }
        });

        // 从0到360扫过所有顶点, 如果不在@1位置做偏移处理, 这里就需要自己排序, 逆时针或者顺时针
        keyPoints.sort((a, b) => {
            var degree1 = ShadowUtils.getAngleForMath(posCenter, a.pos);
            var degree2 = ShadowUtils.getAngleForMath(posCenter, b.pos);
            return degree1 - degree2;
        })

        var drawPoints = keyPoints.map(ele => ele.pos);
        this.drawPoly(this.nodeMaskLight, drawPoints);
        this.drawPoly(this.nodeMaskDark, drawPoints);
	}

	private getStencil(nodeMask: cc.Mask) {
		// @ts-ignore
		return nodeMask._clippingStencil;
	}

	private drawPoly(nodeMask: cc.Mask, points: cc.Vec2[]) {
		var stencil = this.getStencil(nodeMask);
		stencil.clear();
        
        // drawPoly不支持凹多边形, 这里需要将顶点数组转成三角形列表
        var posCenter = this.nodePlayer.position;
        var posLast = null;
        points.forEach(element => {
            if (posLast) {
                stencil.drawPoly([posCenter, element, posLast], cc.Color.WHITE, 0, cc.Color.WHITE);
            }
            posLast = element;
        });
        stencil.drawPoly([posCenter, points[0], posLast], cc.Color.WHITE, 0, cc.Color.WHITE);
    }

    private getSegBorder(corner: IShadowBorderPoint[], degree: number) {
		var borderIndex = 0;
		for (var i = 0; i < corner.length; i++) {
			if (corner[i].degree > degree) {
				borderIndex = i;
				break;
			}
		}
		return [borderIndex, (borderIndex + corner.length - 1) % corner.length];
    }
    
    //================================================ Events
    onTouchStart(touch) {
        var posTouch = touch.getLocation();
        this.nodePlayer.position = cc.pSub(posTouch, this.node.position);
    }

    onTouchMove(touch) {
        var posTouch = touch.getLocation();
        this.nodePlayer.position = cc.pSub(posTouch, this.node.position);
    }

	onEventKeyDown(event) {
        switch(event.keyCode) {
            case 'V'.charCodeAt(0):
                this.step();
                break;
			case 'C'.charCodeAt(0):
                this.getStencil(this.nodeMaskLight).clear();
                this.getStencil(this.nodeMaskDark).clear();
                break;
            case 'A'.charCodeAt(0): // 左
                this.nodePlayer.x -= 50;
                break;
            case 'S'.charCodeAt(0): // 下
                this.nodePlayer.y -= 50;
                break;
            case 'D'.charCodeAt(0): // 右
                this.nodePlayer.x += 50;
                break;
            case 'W'.charCodeAt(0): // 上
                this.nodePlayer.y += 50;
                break;
		}
	}
}
