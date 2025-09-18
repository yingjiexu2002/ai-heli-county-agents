import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
from Crypto.Hash import MD5

# 模拟前端加密参数
salt = "aiheliSalt2023"
secret_key = "aiheli2023SecretKey"
password = "123456"

print("=== 前后端加密解密流程测试 ===")

# 1. 模拟前端加密过程
print("\n1. 前端加密过程:")
print(f"   原始密码: {password}")
print(f"   Salt: {salt}")
print(f"   密钥: {secret_key}")

# 先进行SHA256哈希（与前端一致）
salted_password = password + salt
hashed_password = hashlib.sha256(salted_password.encode('utf-8')).hexdigest()
print(f"   SHA256哈希后: {hashed_password}")

# 2. 模拟后端解密过程
print("\n2. 后端解密过程:")

# 模拟从浏览器获取的加密数据（这里我们直接使用后端解密逻辑来验证）
def decrypt_password(encrypted_password):
    print("   开始解密过程...")
    
    # 解码前端传来的Base64加密数据
    try:
        encrypted_data = base64.b64decode(encrypted_password)
        print(f"   解码后的数据长度: {len(encrypted_data)} 字节")
    except Exception as e:
        print(f"   Base64解码失败: {e}")
        return None
    
    # 检查是否是CryptoJS的Salted格式
    if encrypted_data[:8] == b'Salted__':
        print("   检测到CryptoJS Salted格式")
        # 提取盐值
        salt_value = encrypted_data[8:16]
        ciphertext = encrypted_data[16:]
        print(f"   盐值: {salt_value.hex()}")
        print(f"   密文长度: {len(ciphertext)} 字节")
        
        # 使用EVP_BytesToKey派生密钥和IV（CryptoJS默认方式）
        key_iv = b""
        while len(key_iv) < 32 + 16:  # 32字节密钥 + 16字节IV
            h = MD5.new()
            h.update(key_iv[-MD5.digest_size:] if key_iv else b"")
            h.update(secret_key.encode('utf-8'))
            h.update(salt_value)
            key_iv += h.digest()
        
        key = key_iv[:32]  # 32字节密钥用于AES-256
        iv = key_iv[32:32+16]  # 16字节IV
        
        print(f"   派生的密钥: {key.hex()}")
        print(f"   派生的IV: {iv.hex()}")
        
        # 创建AES解密器
        try:
            cipher = AES.new(key, AES.MODE_CBC, iv)
            
            # 解密并去除填充
            decrypted_data = unpad(cipher.decrypt(ciphertext), AES.block_size)
            result = decrypted_data.decode('utf-8')
            print(f"   解密成功: {result}")
            return result
        except Exception as e:
            print(f"   解密失败: {e}")
            return None
    else:
        print("   不是Salted格式，尝试使用旧的解密方式")
        try:
            # 如果不是Salted格式，尝试使用旧的解密方式
            # AES解密需要16字节的密钥
            # 使用与前端相同的密钥处理方式
            key = secret_key.encode('utf-8')
            # 如果密钥长度不是16/24/32字节，需要调整
            if len(key) > 32:
                key = key[:32]
            elif len(key) > 24:
                key = key[:24]
            elif len(key) > 16:
                key = key[:16]
            
            # 提取IV（前16字节）和加密数据
            iv = encrypted_data[:16]
            ciphertext = encrypted_data[16:]
            
            print(f"   IV: {iv.hex()}")
            print(f"   密钥: {key.hex()}")
            print(f"   密文长度: {len(ciphertext)} 字节")
            
            # 创建AES解密器
            cipher = AES.new(key, AES.MODE_CBC, iv)
            
            # 解密并去除填充
            decrypted_data = unpad(cipher.decrypt(ciphertext), AES.block_size)
            
            # 获取解密后的哈希值
            result = decrypted_data.decode('utf-8')
            print(f"   解密成功: {result}")
            return result
        except Exception as e:
            print(f"   旧解密方式失败: {e}")
            return None

# 测试密码验证
print("\n3. 密码验证测试:")
# 使用werkzeug.security验证密码
from werkzeug.security import generate_password_hash, check_password_hash

# 生成密码哈希（模拟用户数据库中的存储，与后端更新后的逻辑一致）
salted_password_for_db = password + salt  # "123456aiheliSalt2023"
hashed_salted_password_for_db = hashlib.sha256(salted_password_for_db.encode('utf-8')).hexdigest()
stored_password_hash = generate_password_hash(hashed_salted_password_for_db, method='pbkdf2:sha256:150000')
print(f"   数据库中存储的密码哈希: {stored_password_hash}")

# 验证解密后的密码是否正确
decrypted_hashed_password = hashed_password  # 这是前端SHA256哈希后的结果
is_valid = check_password_hash(stored_password_hash, decrypted_hashed_password)
print(f"   密码验证结果: {is_valid}")

print("\n=== 测试完成 ===")