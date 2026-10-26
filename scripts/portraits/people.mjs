/**
 * 种子库 97 位人物的画像检索元数据
 * ------------------------------------------------------------------
 * 用于 scripts/fetch-portraits.mjs 在 Wikimedia Commons 上定位传世画像。
 *
 * 字段说明：
 *   id    种子库人物 ID（与 src/data 中一致）
 *   name  简体姓名
 *   zht   繁体姓名（Commons 上古籍图档多用繁体题名）
 *   py    汉语拼音（首字母大写、音节间空格，与 Commons 的英文题名习惯一致）
 *   pyNs  无空格拼音（部分文件用 CamelCase，如 ZhouYu.jpg）
 *   tags  用于生成馆藏图档题名的辅助标签
 *         'emperor'  帝王 → 清人画帝王名臣像册 / 南薰殿帝后像
 *         'minister' 名臣 → 历代圣贤半身像册 / 历代君臣图像 / 凌烟阁功臣图
 *         'general'  武将 → 三国演义清刊本绣像
 *         'lady'     女性 → 部分图录另立题名
 */
export const PEOPLE = [
  /* ---------------------------- 楚汉 · 秦 ---------------------------- */
  { id: 'person_qin_shi_huang', name: '秦始皇', zht: '秦始皇', py: 'Qin Shi Huang', pyNs: 'QinShiHuang', tags: ['emperor'] },
  { id: 'person_fu_su', name: '扶苏', zht: '扶蘇', py: 'Fu Su', pyNs: 'FuSu', tags: ['minister'] },
  { id: 'person_li_si', name: '李斯', zht: '李斯', py: 'Li Si', pyNs: 'LiSi', tags: ['minister'] },
  { id: 'person_zhao_gao', name: '赵高', zht: '趙高', py: 'Zhao Gao', pyNs: 'ZhaoGao', tags: ['minister'] },
  { id: 'person_chen_sheng', name: '陈胜', zht: '陳勝', py: 'Chen Sheng', pyNs: 'ChenSheng', tags: ['general'] },
  { id: 'person_meng_tian', name: '蒙恬', zht: '蒙恬', py: 'Meng Tian', pyNs: 'MengTian', tags: ['general'] },
  { id: 'person_wu_guang', name: '吴广', zht: '吳廣', py: 'Wu Guang', pyNs: 'WuGuang', tags: ['general'] },
  { id: 'person_qin_er_shi', name: '胡亥', zht: '胡亥', py: 'Hu Hai', pyNs: 'HuHai', tags: ['emperor'] },
  { id: 'person_zi_ying', name: '子婴', zht: '子嬰', py: 'Zi Ying', pyNs: 'ZiYing', tags: ['emperor'] },
  { id: 'person_xiang_yu', name: '项羽', zht: '項羽', py: 'Xiang Yu', pyNs: 'XiangYu', tags: ['general', 'emperor'] },
  { id: 'person_fan_zeng', name: '范增', zht: '范增', py: 'Fan Zeng', pyNs: 'FanZeng', tags: ['minister'] },
  { id: 'person_yu_ji', name: '虞姬', zht: '虞姬', py: 'Yu Ji', pyNs: 'YuJi', tags: ['lady'] },
  { id: 'person_xiang_bo', name: '项伯', zht: '項伯', py: 'Xiang Bo', pyNs: 'XiangBo', tags: ['minister'] },
  { id: 'person_ying_bu', name: '英布', zht: '英布', py: 'Ying Bu', pyNs: 'YingBu', tags: ['general'] },
  { id: 'person_peng_yue', name: '彭越', zht: '彭越', py: 'Peng Yue', pyNs: 'PengYue', tags: ['general'] },
  { id: 'person_liu_bang', name: '刘邦', zht: '劉邦', py: 'Liu Bang', pyNs: 'LiuBang', tags: ['emperor'] },
  { id: 'person_lv_zhi', name: '吕雉', zht: '呂雉', py: 'Lü Zhi', pyNs: 'LvZhi', tags: ['lady', 'emperor'] },
  { id: 'person_qi_fu_ren', name: '戚夫人', zht: '戚夫人', py: 'Qi Furen', pyNs: 'QiFuren', tags: ['lady'] },
  { id: 'person_liu_ying', name: '刘盈', zht: '劉盈', py: 'Liu Ying', pyNs: 'LiuYing', tags: ['emperor'] },
  { id: 'person_liu_heng', name: '刘恒', zht: '劉恆', py: 'Liu Heng', pyNs: 'LiuHeng', tags: ['emperor'] },
  { id: 'person_liu_qi', name: '刘启', zht: '劉啟', py: 'Liu Qi', pyNs: 'LiuQi', tags: ['emperor'] },
  { id: 'person_liu_ruyi', name: '刘如意', zht: '劉如意', py: 'Liu Ruyi', pyNs: 'LiuRuyi', tags: [] },
  { id: 'person_xiao_he', name: '萧何', zht: '蕭何', py: 'Xiao He', pyNs: 'XiaoHe', tags: ['minister'] },
  { id: 'person_zhang_liang', name: '张良', zht: '張良', py: 'Zhang Liang', pyNs: 'ZhangLiang', tags: ['minister'] },
  { id: 'person_han_xin', name: '韩信', zht: '韓信', py: 'Han Xin', pyNs: 'HanXin', tags: ['general'] },
  { id: 'person_chen_ping', name: '陈平', zht: '陳平', py: 'Chen Ping', pyNs: 'ChenPing', tags: ['minister'] },
  { id: 'person_fan_kuai', name: '樊哙', zht: '樊噲', py: 'Fan Kuai', pyNs: 'FanKuai', tags: ['general'] },
  { id: 'person_cao_can', name: '曹参', zht: '曹參', py: 'Cao Can', pyNs: 'CaoCan', tags: ['minister'] },
  { id: 'person_zhou_bo', name: '周勃', zht: '周勃', py: 'Zhou Bo', pyNs: 'ZhouBo', tags: ['general'] },
  { id: 'person_li_shi_qi', name: '郦食其', zht: '酈食其', py: 'Li Yiji', pyNs: 'LiYiji', tags: ['minister'] },
  { id: 'person_lu_jia', name: '陆贾', zht: '陸賈', py: 'Lu Jia', pyNs: 'LuJia', tags: ['minister'] },
  { id: 'person_shu_sun_tong', name: '叔孙通', zht: '叔孫通', py: 'Shusun Tong', pyNs: 'ShusunTong', tags: ['minister'] },
  { id: 'person_kuai_tong', name: '蒯通', zht: '蒯通', py: 'Kuai Tong', pyNs: 'KuaiTong', tags: ['minister'] },
  { id: 'person_mao_dun', name: '冒顿单于', zht: '冒頓單于', py: 'Modu Chanyu', pyNs: 'ModuChanyu', tags: [] },
  { id: 'person_li_guang', name: '李广', zht: '李廣', py: 'Li Guang', pyNs: 'LiGuang', tags: ['general'] },
  { id: 'person_si_ma_qian', name: '司马迁', zht: '司馬遷', py: 'Sima Qian', pyNs: 'SimaQian', tags: ['minister'] },

  /* ---------------------------- 三国 · 汉末 -------------------------- */
  { id: 'person_dong_zhuo', name: '董卓', zht: '董卓', py: 'Dong Zhuo', pyNs: 'DongZhuo', tags: ['general'] },
  { id: 'person_lv_bu', name: '吕布', zht: '呂布', py: 'Lü Bu', pyNs: 'LvBu', tags: ['general'] },
  { id: 'person_yuan_shao', name: '袁绍', zht: '袁紹', py: 'Yuan Shao', pyNs: 'YuanShao', tags: ['general'] },
  { id: 'person_cao_cao', name: '曹操', zht: '曹操', py: 'Cao Cao', pyNs: 'CaoCao', tags: ['emperor', 'general'] },
  { id: 'person_cao_pi', name: '曹丕', zht: '曹丕', py: 'Cao Pi', pyNs: 'CaoPi', tags: ['emperor'] },
  { id: 'person_cao_zhi', name: '曹植', zht: '曹植', py: 'Cao Zhi', pyNs: 'CaoZhi', tags: ['minister'] },
  { id: 'person_guo_jia', name: '郭嘉', zht: '郭嘉', py: 'Guo Jia', pyNs: 'GuoJia', tags: ['minister'] },
  { id: 'person_xun_yu', name: '荀彧', zht: '荀彧', py: 'Xun Yu', pyNs: 'XunYu', tags: ['minister'] },
  { id: 'person_jia_xu', name: '贾诩', zht: '賈詡', py: 'Jia Xu', pyNs: 'JiaXu', tags: ['minister'] },
  { id: 'person_zhang_liao', name: '张辽', zht: '張遼', py: 'Zhang Liao', pyNs: 'ZhangLiao', tags: ['general'] },
  { id: 'person_xiahou_dun', name: '夏侯惇', zht: '夏侯惇', py: 'Xiahou Dun', pyNs: 'XiahouDun', tags: ['general'] },
  { id: 'person_si_ma_yi', name: '司马懿', zht: '司馬懿', py: 'Sima Yi', pyNs: 'SimaYi', tags: ['general'] },
  { id: 'person_si_ma_zhao', name: '司马昭', zht: '司馬昭', py: 'Sima Zhao', pyNs: 'SimaZhao', tags: ['emperor'] },
  { id: 'person_liu_bei', name: '刘备', zht: '劉備', py: 'Liu Bei', pyNs: 'LiuBei', tags: ['emperor'] },
  { id: 'person_guan_yu', name: '关羽', zht: '關羽', py: 'Guan Yu', pyNs: 'GuanYu', tags: ['general'] },
  { id: 'person_zhang_fei', name: '张飞', zht: '張飛', py: 'Zhang Fei', pyNs: 'ZhangFei', tags: ['general'] },
  { id: 'person_zhao_yun', name: '赵云', zht: '趙雲', py: 'Zhao Yun', pyNs: 'ZhaoYun', tags: ['general'] },
  { id: 'person_zhuge_liang', name: '诸葛亮', zht: '諸葛亮', py: 'Zhuge Liang', pyNs: 'ZhugeLiang', tags: ['minister'] },
  { id: 'person_pang_tong', name: '庞统', zht: '龐統', py: 'Pang Tong', pyNs: 'PangTong', tags: ['minister'] },
  { id: 'person_ma_chao', name: '马超', zht: '馬超', py: 'Ma Chao', pyNs: 'MaChao', tags: ['general'] },
  { id: 'person_jiang_wei', name: '姜维', zht: '姜維', py: 'Jiang Wei', pyNs: 'JiangWei', tags: ['general'] },
  { id: 'person_liu_shan', name: '刘禅', zht: '劉禪', py: 'Liu Shan', pyNs: 'LiuShan', tags: ['emperor'] },
  { id: 'person_liu_xie', name: '刘协', zht: '劉協', py: 'Liu Xie', pyNs: 'LiuXie', tags: ['emperor'] },
  { id: 'person_sun_jian', name: '孙坚', zht: '孫堅', py: 'Sun Jian', pyNs: 'SunJian', tags: ['general'] },
  { id: 'person_sun_ce', name: '孙策', zht: '孫策', py: 'Sun Ce', pyNs: 'SunCe', tags: ['general'] },
  { id: 'person_sun_quan', name: '孙权', zht: '孫權', py: 'Sun Quan', pyNs: 'SunQuan', tags: ['emperor'] },
  { id: 'person_zhou_yu', name: '周瑜', zht: '周瑜', py: 'Zhou Yu', pyNs: 'ZhouYu', tags: ['general'] },
  { id: 'person_lu_su', name: '鲁肃', zht: '魯肅', py: 'Lu Su', pyNs: 'LuSu', tags: ['minister'] },
  { id: 'person_lv_meng', name: '吕蒙', zht: '呂蒙', py: 'Lü Meng', pyNs: 'LvMeng', tags: ['general'] },
  { id: 'person_lu_xun', name: '陆逊', zht: '陸遜', py: 'Lu Xun', pyNs: 'LuXun', tags: ['general'] },
  { id: 'person_xun_you', name: '荀攸', zht: '荀攸', py: 'Xun You', pyNs: 'XunYou', tags: ['minister'] },
  { id: 'person_cheng_yu', name: '程昱', zht: '程昱', py: 'Cheng Yu', pyNs: 'ChengYu', tags: ['minister'] },
  { id: 'person_xiahou_yuan', name: '夏侯渊', zht: '夏侯淵', py: 'Xiahou Yuan', pyNs: 'XiahouYuan', tags: ['general'] },
  { id: 'person_huang_zhong', name: '黄忠', zht: '黃忠', py: 'Huang Zhong', pyNs: 'HuangZhong', tags: ['general'] },
  { id: 'person_fa_zheng', name: '法正', zht: '法正', py: 'Fa Zheng', pyNs: 'FaZheng', tags: ['minister'] },
  { id: 'person_ma_su', name: '马谡', zht: '馬謖', py: 'Ma Su', pyNs: 'MaSu', tags: ['general'] },

  /* ---------------------------- 隋唐 -------------------------------- */
  { id: 'person_yang_jian', name: '杨坚', zht: '楊堅', py: 'Yang Jian', pyNs: 'YangJian', tags: ['emperor'] },
  { id: 'person_dugu_qieluo', name: '独孤伽罗', zht: '獨孤伽羅', py: 'Dugu Qieluo', pyNs: 'DuguQieluo', tags: ['lady', 'emperor'] },
  { id: 'person_yang_guang', name: '杨广', zht: '楊廣', py: 'Yang Guang', pyNs: 'YangGuang', tags: ['emperor'] },
  { id: 'person_li_yuan', name: '李渊', zht: '李淵', py: 'Li Yuan', pyNs: 'LiYuan', tags: ['emperor'] },
  { id: 'person_li_shimin', name: '李世民', zht: '李世民', py: 'Li Shimin', pyNs: 'LiShimin', tags: ['emperor'] },
  { id: 'person_li_jiancheng', name: '李建成', zht: '李建成', py: 'Li Jiancheng', pyNs: 'LiJiancheng', tags: [] },
  { id: 'person_li_yuanji', name: '李元吉', zht: '李元吉', py: 'Li Yuanji', pyNs: 'LiYuanji', tags: [] },
  { id: 'person_zhangsun_wuji', name: '长孙无忌', zht: '長孫無忌', py: 'Zhangsun Wuji', pyNs: 'ZhangsunWuji', tags: ['minister'] },
  { id: 'person_wei_zheng', name: '魏征', zht: '魏徵', py: 'Wei Zheng', pyNs: 'WeiZheng', tags: ['minister'] },
  { id: 'person_fang_xuanling', name: '房玄龄', zht: '房玄齡', py: 'Fang Xuanling', pyNs: 'FangXuanling', tags: ['minister'] },
  { id: 'person_du_ruhui', name: '杜如晦', zht: '杜如晦', py: 'Du Ruhui', pyNs: 'DuRuhui', tags: ['minister'] },
  { id: 'person_li_jing', name: '李靖', zht: '李靖', py: 'Li Jing', pyNs: 'LiJing', tags: ['general'] },
  { id: 'person_yuchi_gong', name: '尉迟恭', zht: '尉遲恭', py: 'Yuchi Gong', pyNs: 'YuchiGong', tags: ['general'] },
  { id: 'person_li_ji', name: '李勣', zht: '李勣', py: 'Li Ji', pyNs: 'LiJi', tags: ['general'] },
  { id: 'person_zhangsun_huanghou', name: '长孙氏', zht: '長孫氏', py: 'Zhangsun Shi', pyNs: 'ZhangsunShi', tags: ['lady'] },
  { id: 'person_li_zhi', name: '李治', zht: '李治', py: 'Li Zhi', pyNs: 'LiZhi', tags: ['emperor'] },
  { id: 'person_wu_zetian', name: '武则天', zht: '武則天', py: 'Wu Zetian', pyNs: 'WuZetian', tags: ['emperor', 'lady'] },
  { id: 'person_di_renjie', name: '狄仁杰', zht: '狄仁傑', py: 'Di Renjie', pyNs: 'DiRenjie', tags: ['minister'] },
  { id: 'person_shangguan_waner', name: '上官婉儿', zht: '上官婉兒', py: 'Shangguan Waner', pyNs: 'ShangguanWaner', tags: ['lady'] },
  { id: 'person_li_longji', name: '李隆基', zht: '李隆基', py: 'Li Longji', pyNs: 'LiLongji', tags: ['emperor'] },
  { id: 'person_yang_yuhuan', name: '杨玉环', zht: '楊玉環', py: 'Yang Yuhuan', pyNs: 'YangYuhuan', tags: ['lady'] },
  { id: 'person_an_lushan', name: '安禄山', zht: '安祿山', py: 'An Lushan', pyNs: 'AnLushan', tags: ['general'] },
  { id: 'person_guo_ziyi', name: '郭子仪', zht: '郭子儀', py: 'Guo Ziyi', pyNs: 'GuoZiyi', tags: ['general'] },
  { id: 'person_li_bai', name: '李白', zht: '李白', py: 'Li Bai', pyNs: 'LiBai', tags: ['minister'] },
  { id: 'person_du_fu', name: '杜甫', zht: '杜甫', py: 'Du Fu', pyNs: 'DuFu', tags: ['minister'] },
];
