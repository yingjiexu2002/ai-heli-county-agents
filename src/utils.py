import os
import sys
from flask import current_app

def get_data_path(relative_path):
    """获取资源文件的路径，优先使用exe所在目录下的外部文件，否则退回到PyInstaller打包内资源，再否则使用项目目录。

    示例：get_data_path('data/中国_县.geojson') 或 get_data_path('cert.pem')
    """
    # 首先检查exe所在目录
    try:
        base_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    except Exception:
        base_dir = os.path.abspath('.')

    external_path = os.path.join(base_dir, relative_path)
    if os.path.exists(external_path):
        # 调试提示：优先使用外部资源
        try:
            current_app.logger.debug(f"使用外部资源路径: {external_path}")
        except Exception:
            pass
        return external_path

    # 如果外部文件不存在，则使用打包内的资源
    try:
        # pylint: disable=protected-access,no-member
        base_path = sys._MEIPASS  # PyInstaller临时目录
        internal_path = os.path.join(base_path, relative_path)
        if os.path.exists(internal_path):
            try:
                current_app.logger.debug(f"使用打包内资源路径: {internal_path}")
            except Exception:
                pass
            return internal_path
    except Exception:
        pass

    # 不是通过PyInstaller运行或内部资源不存在时，使用项目目录
    fallback = os.path.join(os.path.abspath('.'), relative_path)
    try:
        current_app.logger.debug(f"使用项目目录路径: {fallback}")
    except Exception:
        pass
    return fallback