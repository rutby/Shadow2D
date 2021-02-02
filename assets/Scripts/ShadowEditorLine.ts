const {ccclass, property, menu, executeInEditMode} = cc._decorator;

@ccclass
@executeInEditMode
@menu("Demo/Shadow/ShadowEditorLine")
export default class ShadowEditorLine extends cc.Component {
    //================================================ cc.Component
    onLoad() {
    }

    update() {
        var collider = this.node.getComponent(cc.PolygonCollider);
        var graph = this.node.getComponent(cc.Graphics);
        graph.clear();
        graph.moveTo(collider.points[0].x, collider.points[0].y);
        graph.lineTo(collider.points[1].x, collider.points[1].y);
        graph.stroke();
    }
}
