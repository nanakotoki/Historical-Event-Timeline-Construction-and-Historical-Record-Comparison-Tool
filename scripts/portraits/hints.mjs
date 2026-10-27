/**
 * 已知图档题名线索（按人物中文名索引）
 * ------------------------------------------------------------------
 * candidatesOf() 生成的是「体系化题名」，能覆盖《历代圣贤半身像》册、
 * 《历代名臣像》、《三才图会》等成系列图档；但 Commons 上还有大量
 * 单件上传的图档，题名是「Emperor Taizong of Tang.jpg」这类无法推导的
 * 自由题名。此表把这类题名显式记录下来，按优先级排在候选表最前。
 *
 * 说明：这里写的只是「可能的题名」，并不代表该文件一定存在。
 * 抓取脚本会逐个做存在性探测，只有真正取回字节流才计入清单；
 * 未命中者一律回落到 L3 复原像，不做任何猜测性标注。
 */
export const HINTS = {
  孙权: ['Portraits of Famous Men - Sun Quan.jpg', 'SunQuan.jpg'],
  关羽: ['Guan Yu Portrait.jpg', 'Guan Yu.jpg'],
  刘启: ['Portraits of Famous Men - Liu Qi.jpg', 'Portraits of Famous Men - Liu Qi 2.jpg'],
  房玄龄: ['Portraits of Famous Men - Fang Xuanling.jpg', 'Portraits of Famous Men - Fang Xuanling 2.jpg'],
  刘恒: ['Portraits of Famous Men - Liu Heng.jpg', 'Portraits of Famous Men - Liu Heng 2.jpg'],
  刘邦: ['Liu Bang.jpg', 'Emperor Gaozu of Han.jpg', 'Portraits of Famous Men - Liu Bang 2.jpg'],
  /* ---------------------------- 楚汉 · 秦 ---------------------------- */
  秦始皇: [
    'Portrait of Qin Shi Huang.jpg',
    'Qin Shi Huang.jpg',
    'Qinshihuang.jpg',
    '秦始皇.jpg',
  ],
  扶苏: ['Fu Su.jpg', 'Fusu.jpg', '扶蘇.jpg'],
  李斯: ['Li Si.jpg', 'LiSi.jpg', '李斯.jpg'],
  赵高: ['Zhao Gao.jpg', 'ZhaoGao.jpg', '趙高.jpg'],
  陈胜: ['Chen Sheng.jpg', 'ChenSheng.jpg', '陳勝.jpg'],
  蒙恬: ['Meng Tian.jpg', 'MengTian.jpg', '蒙恬.jpg'],
  吴广: ['Wu Guang.jpg', 'WuGuang.jpg', '吳廣.jpg'],
  胡亥: ['Qin Er Shi.png', 'Qin Er Shi.jpg'],
  子婴: ['Zi Ying.jpg', 'ZiYing.jpg', '子嬰.jpg'],
  虞姬: ['Yu Ji.jpg', 'Consort Yu.jpg', '虞姬.jpg'],
  项伯: ['Xiang Bo.jpg', '項伯.jpg'],
  英布: ['Ying Bu.jpg', '英布.jpg'],
  彭越: ['Peng Yue.jpg', '彭越.jpg'],
  吕雉: [
    'Empress Lü Zhi.jpg',
    'Lü Zhi.jpg',
    'Lv Zhi.jpg',
    'Empress Lu.jpg',
    '呂雉.jpg',
  ],
  戚夫人: ['Consort Qi.jpg', 'Qi Furen.jpg', '戚夫人.jpg'],
  刘盈: ['Emperor Hui of Han.jpg', 'Liu Ying.jpg', '劉盈.jpg'],
  刘如意: ['Liu Ruyi.jpg', '劉如意.jpg'],
  韩信: ['明人画韩信像轴.png', '汉淮阴侯韩信.jpg', 'Han Xin.jpg', 'Hanxin.jpg', '韓信.jpg'],
  /* 《明人画张良像轴》为故宫旧藏绢本设色立轴，是 Commons 上唯一可确证为
     明清人绘制的张良像。晚笑堂本 Zhang Liang.jpg 亦可取，但版画晚于像轴，故列后。 */
  张良: ['明人画张良像轴.png', 'Zhang Liang.jpg', '張良像.jpg'],
  樊哙: ['Fan Kuai.jpg', '樊噲.jpg'],
  曹参: ['Cao Shen.jpg', '曹參.jpg'],
  周勃: ['Zhou Bo.jpg', '周勃.jpg'],
  郦食其: ['Li Yiji.jpg', '酈食其.jpg'],
  叔孙通: ['Shusun Tong.jpg', '叔孫通.jpg'],
  蒯通: ['Kuai Tong.jpg', '蒯通.jpg'],
  冒顿单于: ['Modu Chanyu.jpg', '冒頓單于.jpg'],
  李广: ['冥山射虎.jpg', 'Li Guang.jpg', '李廣.jpg'],

  /* ------------------------------ 三国 ------------------------------ */
  曹丕: ['CaoPiPortrait.jpg', 'Cao Pi Tang.jpg', 'Cao Pi.jpg', '曹丕.jpg'],
  荀彧: ['Portrait of Xun Yu.jpg', 'Xun Yu.jpg', '荀彧.jpg'],
  刘协: [
    'Emperor Xian of Han.jpg',
    'Liu Xie.jpg',
    '漢獻帝.jpg',
    '劉協.jpg',
    'Han Xiandi.jpg',
  ],
  吕蒙: ['Lü Meng.jpg', 'Lu Meng.jpg', 'Lv Meng.jpg', '呂蒙.jpg'],
  荀攸: ['Xun You.jpg', '荀攸.jpg'],
  程昱: ['Cheng Yu.jpg', 'ChengYu.jpg', '程昱.jpg'],
  夏侯渊: ['Xiahou Yuan.jpg', '夏侯淵.jpg'],

  /* ------------------------------ 隋唐 ------------------------------ */
  杨坚: ['Sui Wendi Tang.jpg', '隋文帝 杨坚.jpg', '隋文帝(說唐演義全傳).jpg', '楊堅.jpg'],
  独孤伽罗: ['獨孤伽羅.jpg', 'Empress Dugu Qieluo.jpg', 'Dugu Qieluo.jpg'],
  /* 注意：Commons 上《說唐演義全傳》绣像一族的题名用的是**全角括号**，
     半角写法探测不到，第一轮即因此漏收杨广、李靖等。此处按实际题名著录。 */
  杨广: [
    '隋煬帝（說唐演義全傳）.jpg',
    '隋煬帝(說唐演義全傳).jpg',
    'Emperor Yang of Sui.jpg',
    'Sui Yangdi.jpg',
    '楊廣.jpg',
  ],
  李世民: ['TangTaizong.jpg', 'TangTaizong (cropped).jpg', '唐太宗立像（一） 軸.png', 'Tang Emperor Taizong.jpg', '唐太宗.jpg'],
  /* 「唐高祖立像 軸」与《唐太宗立像》轴同属南薰殿旧藏历代帝王像，绢本设色，
     是本库能拿到的最接近原件的李渊像；《说唐演义全传》绣像次之。 */
  李渊: ['唐高祖立像 軸.png', '唐高祖（說唐演義全傳）.jpg', '唐高祖.jpg', 'Emperor Gaozu of Tang.jpg'],
  /* 李靖字药师，Commons 上《说唐演义全传》绣像按字题名，故作别名登录。 */
  李靖: ['李藥師（說唐演義全傳）.jpg', '李靖(淩煙閣功臣圖像).jpg', '李靖.jpg'],
  李建成: ['Li Jiancheng.jpg', '李建成.jpg'],
  李元吉: ['Li Yuanji.jpg', '李元吉.jpg'],
  魏征: ['Wei Zheng.jpg', 'Wei Zheng Portrait.jpg', '魏徵.jpg', '魏征.jpg'],
  尉迟恭: ['Yuchi Gong.jpg', 'Yuchi Jingde.jpg', '尉遲恭.jpg'],
  长孙氏: ['Empress Zhangsun.jpg', '長孫皇后.jpg', '长孙皇后.jpg'],
  上官婉儿: ["Shangguan Wan'er.jpg", 'Shangguan Waner.jpg', '上官婉兒.jpg'],
  李隆基: ['李隆基像.jpg', 'Emperor Xuanzong of Tang.jpg', 'Li Longji.jpg', '唐玄宗.jpg'],
  杨玉环: ['Yang Guifei.jpg', 'Yang Yuhuan.jpg', '楊貴妃.jpg', '杨贵妃.jpg'],
  郭子仪: ['Guo Ziyi.jpg', 'Portraits of Famous Men - Guo Ziyi 2.jpg', '郭子儀.jpg'],
  杜甫: ['Du Fu.jpg', 'Dufu.jpg', 'Portrait of Du Fu.jpg', '杜甫.jpg'],
  赵匡胤: ['Song Taizu.jpg', '宋太祖.jpg'],
  赵佶: ['HuizongHui.jpg', 'Emperor Huizong of Song.png', '宋徽宗.jpg'],
  苏轼: ['Su shi.jpg', '蘇軾.jpg'],
  欧阳修: ['宋參政歐陽文忠公修.jpg', 'OuyangXiuPortrait.jpg'],
  范仲淹: ['宋參政范文正公仲淹.jpg', 'Fan Zhongyan scth.jpg'],
  岳飞: ['Yue Fei.jpg', 'Portrait of Yue Fei LACMA M.80.215.jpg'],
  朱熹: ['Portraits of Famous Men - Zhu Xi.jpg', 'Portraits of Famous Men - Zhu Xi 2.jpg'],
  李清照: ['Song dynasty poet Li Qingzhao.jpg', '李清照畫像.jpg'],
  辛弃疾: ['Xin Qiji.jpg'],
  朱元璋: ['明太祖畫像.jpg', '明太祖.jpg'],
  朱棣: ['Yongle.jpg', "Portrait assis de l'empereur Ming Chengzu.jpg", '明成祖.jpg'],
  于谦: ['于謙.jpg', 'Yu Qian.jpg'],
  王守仁: ['王守仁.jpg', 'Wang Yangming.jpg'],
  张居正: ['張居正-清刻版.jpeg', '張居正-清刻版 (cropped).jpeg', 'Zhang Juzheng.jpg'],
  玄烨: ['Kangxi Emperor.jpg', '康熙帝.jpg'],
  胤禛: ['Yongzheng Emperor.jpg', '雍正帝.jpg'],
  弘历: ['Portrait of Emperor Qianlong.jpg', 'Emperor Qianlong.jpg', '乾隆帝.jpg'],
  完颜阿骨打: ['Wanggiyan Aguda.jpg', 'Wanyan Aguda.jpg'],
  耶律阿保机: ['Yelü Abaoji.jpg', '耶律阿保機.jpg'],
  李元昊: ['Li Yuanhao.jpg', '李元昊.jpg'],
  朱温: ['Zhu Wen (Liang Taizu).jpg', 'Emperor Taizu of Later Liang Zhu Wen.jpg', '後梁太祖.jpg'],
  李存勖: ['Zhuangzong of Later Tang.jpg', '後唐莊宗李存勗.jpg'],
  柴荣: ['Chai Rong (Zhou Shizong).jpg', 'Chai Rong scth.jpg', '周世宗.jpg'],
  王莽: ['Wang Mang.jpg', '王莽.jpg'],

  /* ------------------------ 第七批：元 11 / 明 22 / 清 17 ------------------------
     三条主要线索，都经过在 Commons 分类页的实际核对：
     ① 台北故宫《南薰殿历代帝后像》：明代帝王坐像轴以法文题名上传
        （Portrait officiel de l'empereur Jiajing.jpg，NPM Open Data 中畫000318）；
        **注意**《元代帝半身像》册在 Commons 只有太祖至文宗几叶，宪宗蒙哥一叶
        （YuanEmperorAlbumMöngkePortrait.jpg）因出处存疑已于 2014 年被删，
        故蒙哥不再尝试该族题名，只试单件上传的旧题。
     ② 《清代學者象傳》第一集（叶衍兰辑、黄小泉摹绘，纸本设色）：Commons 分类
        「清代學者象傳」有 366 档，顾炎武、戴震、纳兰性德、魏源等已核实确有。
     ③ 各人单件上传的中文裸题名与英文常见题名，逐个探测，存在才收。 */
  蒙哥: ['Möngke Khan.jpg', 'Mongke Khan.jpg', '元憲宗.jpg', '蒙哥.jpg'],
  旭烈兀: ['Hulagu Khan.jpg', 'Hulegu Khan.jpg', 'Hulagu.jpg', '旭烈兀.jpg'],
  刘秉忠: ['劉秉忠.jpg', '刘秉忠.jpg'],
  许衡: ['許衡.jpg', 'Xu Heng.jpg'],
  张弘范: ['張弘範.jpg', '张弘范.jpg'],
  阿合马: ['阿合馬.jpg', '阿合马.jpg'],
  王保保: ['扩廓帖木儿.jpg', '擴廓帖木兒.jpg', '王保保.jpg'],
  韩林儿: ['韓林兒.jpg', '韩林儿.jpg'],
  陈友谅: ['陳友諒.jpg', 'Chen Youliang.jpg'],
  张士诚: ['張士誠.jpg', 'Zhang Shicheng.jpg'],
  明玉珍: ['明玉珍.jpg'],
  朱厚熜: ["Portrait officiel de l'empereur Jiajing.jpg", 'Jiajing.jpg', '明世宗坐像.jpg', '明世宗.jpg'],
  杨士奇: ['楊士奇.jpg', 'Yang Shiqi.jpg'],
  杨荣: ['楊榮.jpg'],
  杨溥: ['楊溥.jpg'],
  俞大猷: ['俞大猷.jpg', 'Yu Dayou.jpg', '俞大猷像.jpg'],
  胡宗宪: ['胡宗憲.jpg', 'Hu Zongxian.jpg'],
  杨慎: ['楊慎.jpg', 'Yang Shen.jpg'],
  唐寅: ['Tang Yin.jpg', '唐寅.jpg', '唐伯虎.jpg', 'Tang Yin portrait.jpg'],
  文徵明: ['Wen Zhengming.jpg', '文徵明.jpg', '文徵明像.jpg'],
  徐渭: ['Xu Wei.jpg', '徐渭.jpg', '徐文长.jpg', '徐渭像.jpg'],
  严嵩: ['嚴嵩.jpg', 'Yan Song.jpg'],
  夏言: ['夏言.jpg', 'Xia Yan.jpg'],
  高拱: ['高拱.jpg', 'Gao Gong.jpg'],
  孙承宗: ['孫承宗.jpg', 'Sun Chengzong.jpg'],
  熊廷弼: ['熊廷弼.jpg', 'Xiong Tingbi.jpg'],
  卢象升: ['盧象升.jpg', 'Lu Xiangsheng.jpg'],
  秦良玉: ['秦良玉.jpg', 'Qin Liangyu.jpg'],
  李定国: ['李定國.jpg', 'Li Dingguo.jpg'],
  史可法: ['Shi Kefa.jpg', '史可法.jpg', '史可法像.jpg'],
  黄宗羲: ['Huang Zongxi.jpg', '黃宗羲.jpg', '黄宗羲.jpg'],
  王夫之: ['Wang Fuzhi.jpg', '王夫之.jpg', '王夫之像.jpg'],
  顾炎武: ['Gu yanwu.jpg', 'Gu Yanwu.jpg', '顾炎武.jpg', '顾亭林.jpg'],
  孝庄文皇后: [
    '孝庄文皇后朝服像.jpg',
    'Empress Dowager Xiaozhuang.jpg',
    '孝莊文皇后朝服像.jpg',
    '孝庄文皇后.jpg',
    'Xiaozhuang.jpg',
  ],
  张廷玉: ['张廷玉.jpg', '張廷玉.jpg', 'Zhang Tingyu.jpg'],
  傅恒: ['傅恆.jpg', '傅恒.jpg', 'Fu Heng.jpg'],
  福康安: ['福康安.jpg', "Fukang'an.jpg", 'Fukang an.jpg'],
  兆惠: ['兆惠.jpg', 'Zhao Hui.jpg'],
  岳钟琪: ['岳鍾琪.jpg', '岳钟琪.jpg', 'Yue Zhongqi.jpg'],
  戴震: ['Dai Zhen.png', 'Dai Zhen.jpg', '戴震.jpg', '戴東原.jpg'],
  龚自珍: ['龔自珍.png', '龔自珍.jpg', '龚自珍.jpg', 'Gong Zizhen.jpg'],
  魏源: ['Wei Yuan.png', '魏源.jpg', 'Wei Yuan.jpg'],
  纳兰性德: ['Nalan Xingde.jpg', '納蘭性德.jpg', '纳兰性德.jpg'],
  洪秀全: ['Hong Xiuquan.jpg', '洪秀全.jpg'],
  杨秀清: ['楊秀清.jpg', 'Yang Xiuqing.jpg'],
  石达开: ['石達開.jpg', '石达开.jpg'],
  李秀成: ['李秀成.jpg', 'Li Xiucheng.jpg'],
  邓世昌: ['鄧世昌.jpg', '邓世昌.jpg', 'Deng Shichang.jpg'],
  丁汝昌: ['丁汝昌.jpg', 'Ding Ruchang.jpg'],
};
