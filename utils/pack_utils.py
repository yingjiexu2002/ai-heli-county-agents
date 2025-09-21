import os
import sys
import shutil

def ensure_external_data_exists():
    """确保外部data文件夹存在，并包含必要的数据文件"""
    base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    external_data_dir = os.path.join(base_dir, 'data')
    
    # 确保外部data目录存在
    if not os.path.exists(external_data_dir):
        os.makedirs(external_data_dir)
    
    # 需要复制的文件列表
    data_files = ['爱河狸数据_地址拆分.csv', '中国_县.geojson']
    
    for filename in data_files:
        external_file = os.path.join(external_data_dir, filename)
        
        # 如果外部文件不存在，则从内部资源复制
        if not os.path.exists(external_file):
            try:
                # 尝试从PyInstaller打包的资源中获取
                try:
                    internal_file = os.path.join(sys._MEIPASS, 'data', filename)
                except Exception:
                    # 开发环境中直接使用相对路径
                    internal_file = os.path.join('data', filename)
                
                if os.path.exists(internal_file):
                    import shutil
                    shutil.copy2(internal_file, external_file)
                    print(f"已创建外部数据文件: {external_file}")
            except Exception as e:
                print(f"复制数据文件时出错: {str(e)}")