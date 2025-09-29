#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API性能测试工具
用于测试geojson接口的响应时间并生成报告
"""

import requests
import time
import statistics
import json
from datetime import datetime
import urllib3
import warnings

# 禁用SSL警告，因为我们使用自签名证书
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
warnings.filterwarnings("ignore", message="Unverified HTTPS request")

class APIPerformanceTester:
    def __init__(self, base_url='https://127.0.0.1:5000'):
        self.base_url = base_url
        self.session = requests.Session()
        # 禁用SSL验证，因为使用自签名证书
        self.session.verify = False
        
    def test_endpoint(self, endpoint, num_requests=10, method='GET', data=None, headers=None):
        """
        测试指定端点的响应时间
        
        Args:
            endpoint: 要测试的接口路径
            num_requests: 测试次数
            method: HTTP方法
            data: 请求数据
            headers: 请求头
            
        Returns:
            dict: 包含测试结果的字典
        """
        url = f"{self.base_url}{endpoint}"
        response_times = []
        errors = []
        
        print(f"\n正在测试接口: {url}")
        print(f"测试次数: {num_requests}")
        print("=" * 50)
        
        for i in range(num_requests):
            try:
                start_time = time.time()
                
                if method.upper() == 'GET':
                    response = self.session.get(url, headers=headers, timeout=30)
                elif method.upper() == 'POST':
                    response = self.session.post(url, json=data, headers=headers, timeout=30)
                
                end_time = time.time()
                response_time = end_time - start_time
                
                if response.status_code == 200:
                    response_times.append(response_time)
                    print(f"请求 {i+1:2d}: {response_time:.3f}s - 成功 (数据大小: {len(response.content)} 字节)")
                else:
                    errors.append(f"请求 {i+1} 失败: HTTP {response.status_code}")
                    print(f"请求 {i+1:2d}: 失败 - HTTP {response.status_code}")
                
            except Exception as e:
                errors.append(f"请求 {i+1} 异常: {str(e)}")
                print(f"请求 {i+1:2d}: 异常 - {str(e)}")
        
        if response_times:
            result = {
                'endpoint': endpoint,
                'total_requests': num_requests,
                'successful_requests': len(response_times),
                'failed_requests': num_requests - len(response_times),
                'min_time': min(response_times),
                'max_time': max(response_times),
                'avg_time': statistics.mean(response_times),
                'median_time': statistics.median(response_times),
                'std_dev': statistics.stdev(response_times) if len(response_times) > 1 else 0,
                'errors': errors,
                'raw_times': response_times,
                'test_time': datetime.now().isoformat()
            }
        else:
            result = {
                'endpoint': endpoint,
                'total_requests': num_requests,
                'successful_requests': 0,
                'failed_requests': num_requests,
                'errors': errors,
                'test_time': datetime.now().isoformat()
            }
        
        return result
    
    def print_results(self, result):
        """打印测试结果"""
        print("\n" + "=" * 60)
        print("测试结果汇总")
        print("=" * 60)
        print(f"接口: {result['endpoint']}")
        print(f"总请求数: {result['total_requests']}")
        print(f"成功请求数: {result['successful_requests']}")
        print(f"失败请求数: {result['failed_requests']}")
        
        if result['successful_requests'] > 0:
            print(f"\n响应时间统计:")
            print(f"  最小时间: {result['min_time']:.3f}s")
            print(f"  最大时间: {result['max_time']:.3f}s")
            print(f"  平均时间: {result['avg_time']:.3f}s")
            print(f"  中位时间: {result['median_time']:.3f}s")
            print(f"  标准差: {result['std_dev']:.3f}s")
            
            # 性能评估
            avg_time = result['avg_time']
            if avg_time < 1.0:
                performance = "优秀"
            elif avg_time < 2.0:
                performance = "良好"
            elif avg_time < 5.0:
                performance = "一般"
            else:
                performance = "需要优化"
            
            print(f"\n性能评估: {performance}")
        
        if result['errors']:
            print(f"\n错误信息:")
            for error in result['errors']:
                print(f"  - {error}")
    
    def save_results(self, result, filename=None):
        """保存测试结果到文件"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"api_performance_test_{timestamp}.json"
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        
        print(f"\n测试结果已保存到: {filename}")

def main():
    """主函数"""
    tester = APIPerformanceTester()
    
    # 测试geojson接口
    result = tester.test_endpoint('/api/geojson', num_requests=5)
    tester.print_results(result)
    tester.save_results(result)
    
    return result

if __name__ == '__main__':
    result = main()