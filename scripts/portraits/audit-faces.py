#!/usr/bin/env python
"""
人脸框审计脚本（离线）
================================================================
产物是 scripts/portraits/faces.json：每张图档里人脸的位置与大小，
由 build-crops.mjs 直接拿来定取景窗口。

为什么单开一个 Python 脚本：这一步需要 OpenCV 的 YuNet 模型，而项目的
常规构建链是纯 Node。把检测结果落成 JSON 之后，构建就不再依赖它——
faces.json 跟着仓库走，crops.json 也随之可复现。只有新增图档时才需要重跑。

依赖：
    python -m pip install opencv-python-headless
    curl -L -o .tmp/yunet.onnx \
      https://hf-mirror.com/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx

用法：
    python scripts/portraits/audit-faces.py [模型路径]

未检出的图（多为白描、绣像、器物局部）不会出现在结果里，build-crops.mjs
会退回行剖面启发式；两者都不对的少数图档由 crop-overrides.json 兜底。
"""
import glob
import json
import os
import sys

import cv2
import numpy as np

MODEL = sys.argv[1] if len(sys.argv) > 1 else '.tmp/yunet.onnx'
OUT = os.path.join(os.path.dirname(__file__), 'faces.json')
MIN_SCORE = 0.55
LONG_SIDE = 640


def imread_unicode(path: str):
    """cv2.imread 在本机不支持非 ASCII 路径（项目目录名带中文），走字节解码。"""
    buf = np.fromfile(path, dtype=np.uint8)
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


def main() -> None:
    if not os.path.exists(MODEL):
        sys.exit(f'找不到模型：{MODEL}（见脚本头部注释里的下载命令）')
    det = cv2.FaceDetectorYN.create(MODEL, '', (320, 320), MIN_SCORE, 0.3, 5000)
    root = os.path.join(os.path.dirname(__file__), '..', '..')
    files = sorted(glob.glob(os.path.join(root, 'public', 'data', 'portraits', 'person_*.jpg')))
    result = {}
    for path in files:
        img = imread_unicode(path)
        if img is None:
            continue
        h, w = img.shape[:2]
        scale = LONG_SIDE / max(h, w)
        probe = cv2.resize(img, (int(w * scale), int(h * scale))) if scale < 1 else img
        ph, pw = probe.shape[:2]
        det.setInputSize((pw, ph))
        _, faces = det.detect(probe)
        if faces is None or len(faces) == 0:
            continue
        best = max(faces, key=lambda r: r[2] * r[3])
        x, y, fw, fh = [float(v) for v in best[:4]]
        result[os.path.basename(path)[:-4]] = {
            'x': round(x / pw, 4),
            'y': round(y / ph, 4),
            'w': round(fw / pw, 4),
            'h': round(fh / ph, 4),
            'score': round(float(best[-1]), 3),
        }
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(result, fh, ensure_ascii=False, indent=1)
    print(f'已写入 {OUT}：{len(result)}/{len(files)} 张检出人脸')


if __name__ == '__main__':
    main()
