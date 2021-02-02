export default class ShadowUtils{
    public static getAngleForMath(startPos, endPos): number{
        let diff_x = endPos.x - startPos.x;
        let diff_y = endPos.y - startPos.y;
        if(diff_x == 0){
            return diff_y == 0 ? 0 : (diff_y > 0 ? 90 : 270);
        }
        if(diff_y == 0){
            return diff_x > 0 ? 0 : 180;
        }
        let angle = 360*Math.atan(diff_y/diff_x)/(2*Math.PI);
        if (diff_x > 0 && diff_y > 0) {
            //第一象限不变
        }else if(diff_x > 0 && diff_y < 0){
            angle = 360+angle;
        }else if(diff_x < 0 && diff_y < 0){
            angle = 180+angle;
        }else if(diff_x < 0 && diff_y > 0){
            angle = 180+angle;
        }
        return angle;
    }
}
