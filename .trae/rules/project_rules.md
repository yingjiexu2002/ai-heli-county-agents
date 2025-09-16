# 需求
爱河狸是一家公司，其下签约了很多地方县城的县总代。但是目前只有一个县总代表格，不能直观地看到哪个县是否已经有了县总代，哪些县还没有县总代。
现在希望做一个网页，网页内容为一个地图，可以看出中国哪些县已经有了县总代，有县总代的地区用特定颜色区分，没有县总代的县就呈现灰色。并且点击某个县的位置，需要能显示详细信息（包括县总代是谁、手机号码等），并且选中的县需要高亮显示。
权限要求：只有管理员权限才能对内容进行修改，其他成员只能查看信息。
使用python快速开发。
# 数据
获取地址二：https://cloudcenter.tianditu.gov.cn/administrativeDivision/
可以直接下载县级数据的geojson。

当前需求使用地址二下载的数据文件中国_县.geojson
后端
接口定义
1. 获取县总代数据
GET /api/agents
响应: {
    "status": "success",
    "data": {
        "北京市": {
            "朝阳区": {
                "name": "张三",
                "phone": "13800138000",
                "has_agent": true
            }
        }
    }
}
2. 获取单个县信息
GET /api/county/<county_name>
响应: {
    "status": "success",
    "data": {
        "name": "县名",
        "agent_name": "县总代姓名",
        "agent_phone": "手机号",
        "has_agent": true
    }
}
3. 更新县总代信息（管理员）
PUT /api/county/<county_name>
请求体: {
    "agent_name": "新县总代姓名",
    "agent_phone": "新手机号"
}
响应: {
    "status": "success",
    "message": "更新成功"
}
4. 管理员登录
POST /api/login
请求体: {
    "username": "admin",
    "password": "123456"
}
响应: {
    "status": "success",
    "token": "session_token",
    "is_admin": true
}