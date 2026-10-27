/**
 * 分片 · 宋元明清 · 补遗连线（元、明、清）
 * ------------------------------------------------------------------
 * 这三批人物是「半边图」的填补：原来图上有文天祥没有张弘范，有戚继光没有胡宗宪，
 * 有曾国藩没有洪秀全，有李鸿章没有丁汝昌。补边的第一要务不是好看，
 * 是让每一场原本只见一方的戏，把对面的人接上。
 *
 * 四条纪律：
 *  1. **已有边不重连。** 文天祥—张世杰、徐达—常遇春、郑成功—施琅一类原本就有，
 *     此处绕开；张弘范不直接连文天祥以外的宋臣，改从「五坡岭」「崖山」两个具体事件切入。
 *  2. **不相及者不硬连。** 史可法卒于弘光元年（1645），郑成功大规模用兵在顺治末，
 *     二人虽同属南明而事不相反，故不立边；戴震与纪昀虽同预四库馆，
 *     但两人本传皆不载彼此交谊，故戴震一系只连乾隆一朝，不攀附学术网络。
 *  3. **「同传并列」类边必须写明是并置而非交往。** 黄宗羲与王夫之终身未曾谋面，
 *     只因同为明遗民、同入《清史稿·儒林一》而立边，summary 里须把这一点讲清楚，
 *     不能让读者误以为二人有来往。
 *  4. **议和、并立、师承类边 directed=false。** 韩林儿与朱元璋的「龙凤君臣」
 *     名实相违（君是虚名，权在朱手），写成有向君臣会误导读图，故用无向。
 */
import { rb } from '../_helpers';

const YS = '《元史》';
const MS = '《明史》';
const QSG = '《清史稿》';

export const ymqEdges = [
  /* ============================ 元：宗室与西征 ============================ */
  rb('ymq_mengge_xuliewu', 'meng_ge', 'xu_lie_wu', 'kinship_blood', '兄弟·命其西征', true, 9,
    '蒙哥即位后命弟旭烈兀统军西征，自怯绿连河誓师而西，灭木剌夷、陷报达。旭烈兀所部为拖雷系诸子中最远出的一支。',
    [YS, '卷三·宪宗本纪'], { startYear: 1253, endYear: 1259 }),

  rb('ymq_mengge_hubilie', 'meng_ge', 'hu_bi_lie', 'kinship_blood', '兄弟·总漠南汉地', true, 10,
    '蒙哥即位，命弟忽必烈总漠南汉地军国庶事，开府金莲川，用汉人儒士。忽必烈由是得汉地之基，日后争位亦赖此。',
    [YS, '卷三·宪宗本纪'], { startYear: 1251, endYear: 1259 }),

  rb('ymq_liubingzhong_hubilie', 'liu_bing_zhong', 'hu_bi_lie', 'monarch_subject', '潜邸谋主', true, 10,
    '秉忠以僧人子聪之身入忽必烈潜邸，参预机谋三十余年：奏建国号「大元」、定都燕京、营建大都，元初立国规模多出其手。',
    [YS, '卷一百五十七·刘秉忠传'], { startYear: 1242, endYear: 1274 }),

  rb('ymq_xuheng_hubilie', 'xu_heng', 'hu_bi_lie', 'monarch_subject', '国子祭酒', true, 8,
    '许衡世祖朝为国子祭酒，以《小学》《四书》教蒙古贵胄子弟，元初国学之制由其奠定；至元间又与郭守敬等同领改历事。',
    [YS, '卷一百五十八·许衡传'], { startYear: 1260, endYear: 1281 }),

  rb('ymq_xuheng_guoshoujing', 'xu_heng', 'guo_shoujing', 'political_ally', '同领改历', false, 8,
    '至元十三年诏修新历，许衡与郭守敬、王恂同领其事。衡主其理、守敬主其数，历成即《授时历》，行用三百余年。',
    [YS, '卷一百五十八·许衡传'], { startYear: 1276, endYear: 1281 }),

  rb('ymq_xuheng_ahema', 'xu_heng', 'a_he_ma', 'political_rival', '正言不少让', false, 8,
    '阿合马以理财得幸，势倾中外，许衡每与论事必正言不少让，屡言其「蠹国害民」。二人之争为世祖朝儒臣与理财之臣对立的典型。',
    [YS, '卷一百五十八·许衡传'], { startYear: 1262, endYear: 1281 }),

  rb('ymq_ahema_hubilie', 'a_he_ma', 'hu_bi_lie', 'monarch_subject', '理财见幸', true, 8,
    '世祖连年用兵，国用不足，阿合马以增课、括户、行钞诸法充军费，遂由中书左右部累迁平章政事，专擅近二十年。',
    [YS, '卷二百五·奸臣传'], { startYear: 1262, endYear: 1282 }),

  /* ============================ 元：灭宋两役 ============================ */
  rb('ymq_zhanghongfan_hubilie', 'zhang_hong_fan', 'hu_bi_lie', 'monarch_subject', '蒙古汉军都元帅', true, 8,
    '弘范为张柔第九子，至元十五年授蒙古汉军都元帅，总兵南下追宋室残部，为灭宋之役的主帅。',
    [YS, '卷一百五十六·张弘范传'], { startYear: 1278, endYear: 1280 }),

  rb('ymq_zhanghongfan_wentianxiang', 'zhang_hong_fan', 'wen_tianxiang', 'military_adversary', '五坡岭被执', false, 10,
    '祥兴元年十二月，弘范部将袭文天祥于海丰五坡岭，天祥被执。弘范待以客礼，屡劝之降，天祥书《过零丁洋》以答，终不屈。',
    [YS, '卷一百五十六·张弘范传'], { startYear: 1278, endYear: 1279 }),

  rb('ymq_zhanghongfan_zhangshijie', 'zhang_hong_fan', 'zhang_shijie', 'military_adversary', '崖山破宋', false, 10,
    '祥兴二年二月，弘范率舟师攻崖山，张世杰结大舶千余作一字阵拒之，兵败，陆秀夫负幼帝赵昺投海，南宋亡。弘范于崖山勒石纪功。',
    [YS, '卷一百五十六·张弘范传'], { startYear: 1279, endYear: 1279 }),

  /* =========================== 元：末路与群雄 =========================== */
  rb('ymq_wangbaobao_xuda', 'wang_bao_bao', 'xu_da', 'military_adversary', '沈儿峪与岭北', false, 9,
    '洪武三年沈儿峪之战，徐达大破扩廓帖木儿，保保仅与妻子数人北遁和林；洪武五年徐达出岭北，反为保保所破，明军死者数万。二人两战一胜一负。',
    [MS, '卷一百二十五·徐达传'], { startYear: 1370, endYear: 1372 }),

  rb('ymq_hanliner_liufutong', 'han_lin_er', 'liu_futong', 'monarch_subject', '迎立亳州', true, 9,
    '至正十五年刘福通迎韩林儿至亳州，立为皇帝，号小明王，国号宋，建元龙凤。北方红巾军皆奉其正朔，而实权在福通。',
    [MS, '卷一百二十二·韩林儿传'], { startYear: 1355, endYear: 1363 }),

  rb('ymq_hanliner_zhuyuanzhang', 'han_lin_er', 'zhu_yuanzhang', 'political_ally', '龙凤君臣·安丰之救', false, 8,
    '朱元璋初奉龙凤年号，名义上为韩林儿之臣。龙凤九年张士诚部将吕珍围安丰，朱元璋亲率军救之，迎林儿居滁州，自此遂为朱氏所挟。名实相违，故用无向边。',
    [MS, '卷一百二十二·韩林儿传'], { startYear: 1355, endYear: 1367 }),

  rb('ymq_zhangshicheng_hanliner', 'zhang_shi_cheng', 'han_lin_er', 'military_adversary', '吕珍围安丰', false, 8,
    '龙凤九年，张士诚遣部将吕珍攻安丰，韩林儿与刘福通被围，城中食尽。朱元璋自率军来救，林儿得脱，而红巾军一系自此不振。',
    [MS, '卷一百二十二·韩林儿传'], { startYear: 1363, endYear: 1363 }),

  rb('ymq_chenyouliang_zhuyuanzhang', 'chen_you_liang', 'zhu_yuanzhang', 'military_adversary', '鄱阳湖决战', false, 10,
    '至正二十三年陈友谅倾国六十万围洪都八十五日，朱元璋自应天来援，决战于鄱阳湖。汉军巨舰连锁，朱军以火攻破之，友谅中流矢死。南方归于一统自此始。',
    [MS, '卷一百二十三·陈友谅传'], { startYear: 1363, endYear: 1363 }),

  rb('ymq_zhangshicheng_zhuyuanzhang', 'zhang_shi_cheng', 'zhu_yuanzhang', 'military_adversary', '平江之围', false, 10,
    '至正二十六年朱元璋既灭陈友谅，命徐达、常遇春攻张士诚，湖州、杭州相继下，平江被围十月。二十七年九月城破，士诚被俘自缢。',
    [MS, '卷一百二十三·张士诚传'], { startYear: 1366, endYear: 1367 }),

  rb('ymq_mingyuzhen_chenyouliang', 'ming_yu_zhen', 'chen_you_liang', 'political_rival', '不服友谅', false, 8,
    '明玉珍本为徐寿辉部将，入蜀据重庆。陈友谅杀徐寿辉自立，玉珍不服，遂不复通，越三年自称帝于重庆，国号夏。',
    [MS, '卷一百二十三·明玉珍传'], { startYear: 1360, endYear: 1366 }),

  /* =========================== 明：大礼议与内阁 =========================== */
  rb('ymq_zhuhoucong_yangshen', 'zhu_hou_cong', 'yang_shen', 'monarch_subject', '大礼议廷杖谪戍', true, 9,
    '嘉靖三年大礼议起，杨慎率群臣伏左顺门撼门大哭，声彻殿庭。世宗命廷杖之，慎两遭杖几死，谪戍云南永昌卫，终世宗之世六次大赦皆不原。',
    [MS, '卷一百九十二·杨慎传'], { startYear: 1524, endYear: 1559 }),

  rb('ymq_zhuhoucong_yansong', 'zhu_hou_cong', 'yan_song', 'monarch_subject', '青词得幸', true, 8,
    '世宗中年以后专意斋醮，严嵩所作青词最称旨，遂于嘉靖二十一年拜武英殿大学士入阁，柄政近二十年。',
    [MS, '卷三百八·奸臣传'], { startYear: 1542, endYear: 1562 }),

  rb('ymq_zhuhoucong_xiayan', 'zhu_hou_cong', 'xia_yan', 'monarch_subject', '河套之议·弃市', true, 8,
    '夏言以主张天地分祭得世宗欢心而累官首辅，后因力赞曾铣复河套之议，世宗意变，遂为严嵩所构，嘉靖二十七年弃市。',
    [MS, '卷一百九十六·夏言传'], { startYear: 1536, endYear: 1548 }),

  rb('ymq_yangshiqi_yangrong', 'yang_shi_qi', 'yang_rong', 'political_ally', '三杨共政·东杨西杨', false, 9,
    '士奇与荣同直内阁四十余年，一以学行、一以才略，时称「西杨文学，东杨政事」。正统初英宗年幼，凡政令多出二人之手。',
    [MS, '卷一百四十八·杨荣传'], { startYear: 1403, endYear: 1440 }),

  rb('ymq_yangrong_yangpu', 'yang_rong', 'yang_pu', 'political_ally', '三杨共政', false, 9,
    '溥与荣同举建文二年进士，宣德以后同入内阁。三杨并相二十余年，为明代内阁最安定的一段时期。',
    [MS, '卷一百四十八·杨溥传'], { startYear: 1426, endYear: 1440 }),

  rb('ymq_yangshiqi_yangpu', 'yang_shi_qi', 'yang_pu', 'political_ally', '三杨共政', false, 8,
    '士奇与溥同辅仁、宣、英三朝，溥尝系狱十年，出而与士奇并相。三杨既没，王振遂无所忌惮。',
    [MS, '卷一百四十八·杨溥传'], { startYear: 1424, endYear: 1444 }),

  rb('ymq_yansong_xiayan', 'yan_song', 'xia_yan', 'political_rival', '构陷弃市', false, 10,
    '夏言性刚，对严嵩尤加轻慢，嵩衔之次骨。嘉靖二十七年严嵩劾言「强君胁众」，言与曾铣同弃市。言死，嵩遂独相二十年。',
    [MS, '卷一百九十六·夏言传'], { startYear: 1536, endYear: 1548 }),

  rb('ymq_gaogong_zhangjuzheng', 'gao_gong', 'zhang_juzheng', 'political_rival', '隆庆末被逐', false, 9,
    '穆宗崩，高拱虑司礼监冯保专权，谋去之；冯保与张居正合谋，以「十岁太子如何治天下」一语构之，拱遂罢归，居正代为首辅。',
    [MS, '卷二百一十三·高拱传'], { startYear: 1572, endYear: 1572 }),

  /* ============================ 明：吴中文苑 ============================ */
  rb('ymq_tangyin_wenzhengming', 'tang_yin', 'wen_zheng_ming', 'political_ally', '吴中四才子（并置）', false, 8,
    '唐寅与文徵明同列「吴中四才子」（余二人为祝允明、徐祯卿），又同列「吴门四家」。二人年岁相同而遭际迥异：一以科场案废黜终身，一以贡生入翰林而终老吴门。此边为同侪并置，非师承。',
    [MS, '卷二百八十六·文苑二（唐寅附传）'], { startYear: 1490, endYear: 1524 }),

  /* ============================ 明：抗倭一线 ============================ */
  rb('ymq_yansong_yudayou', 'yan_song', 'yu_da_you', 'political_rival', '抑其功', false, 7,
    '俞大猷转战东南，功多而赏薄。岑港之役失利，严嵩柄政，遂抑其功不叙；大猷屡起屡踬，时论为之不平。',
    [MS, '卷二百一十二·俞大猷传'], { startYear: 1557, endYear: 1562 }),

  rb('ymq_yansong_huzongxian', 'yan_song', 'hu_zong_xian', 'political_ally', '结交严氏父子', false, 8,
    '胡宗宪总督东南，以厚赂结交严嵩父子及赵文华，得久于其位。严嵩败，宗宪遂被劾下狱，终瘐死狱中。',
    [MS, '卷二百五·胡宗宪传'], { startYear: 1556, endYear: 1562 }),

  rb('ymq_huzongxian_yudayou', 'hu_zong_xian', 'yu_da_you', 'monarch_subject', '委罪下狱', true, 7,
    '嘉靖四十年，胡宗宪以所部失事委罪于俞大猷，大猷夺职系狱，赖戚继光等力救得免。此为大猷仕途最屈之一节。',
    [MS, '卷二百一十二·俞大猷传'], { startYear: 1561, endYear: 1561 }),

  rb('ymq_huzongxian_qijiguang', 'hu_zong_xian', 'qi_jiguang', 'monarch_subject', '节制其军', true, 8,
    '戚继光练义乌兵、创鸳鸯阵，皆在胡宗宪总督东南任内。宗宪用其军平倭，戚家军之名由是起。',
    [MS, '卷二百一十二·戚继光传'], { startYear: 1556, endYear: 1562 }),

  rb('ymq_huzongxian_xuwei', 'hu_zong_xian', 'xu_wei', 'monarch_subject', '幕中书记', true, 8,
    '徐渭入胡宗宪幕掌书记，参预抗倭方略；宗宪得白鹿，命渭草《进白鹿表》以进，世宗大悦。宗宪下狱死，渭惧祸而狂。',
    [MS, '卷二百八十八·文苑四·徐渭传'], { startYear: 1557, endYear: 1565 }),

  rb('ymq_yudayou_qijiguang', 'yu_da_you', 'qi_jiguang', 'political_ally', '俞龙戚虎', false, 9,
    '俞大猷与戚继光同时抗倭，一以舟师阵法、一以练兵制阵，并称「俞龙戚虎」。大猷下狱时，继光与诸将力救之。',
    [MS, '卷二百一十二·俞大猷传'], { startYear: 1555, endYear: 1568 }),

  /* ============================ 明：辽事与殉国 ============================ */
  rb('ymq_sunchengzong_yuanchonghuan', 'sun_cheng_zong', 'yuan_chonghuan', 'monarch_subject', '僚佐受知', true, 8,
    '孙承宗督师山海关，修宁远、前屯诸城，其僚佐袁崇焕、祖大寿、满桂皆一时之选。宁锦防线之立，二人相须而成。',
    [MS, '卷二百五十·孙承宗传'], { startYear: 1622, endYear: 1625 }),

  rb('ymq_sunchengzong_weizhongxian', 'sun_cheng_zong', 'wei_zhongxian', 'political_rival', '为阉党所劾', false, 8,
    '孙承宗督师辽东，功高而为魏忠贤所忌。天启五年阉党劾其「糜饷」、嗾其党攻之，承宗遂罢归。',
    [MS, '卷二百五十·孙承宗传'], { startYear: 1625, endYear: 1625 }),

  rb('ymq_xiongtingbi_weizhongxian', 'xiong_ting_bi', 'wei_zhongxian', 'political_rival', '阉党杀之·传首九边', false, 8,
    '熊廷弼以广宁失陷下狱，天启五年阉党借「辽事」倾东林，遂杀廷弼，传首九边。崇祯初始诏许归葬。',
    [MS, '卷二百五十九·熊廷弼传'], { startYear: 1622, endYear: 1625 }),

  rb('ymq_luxiangsheng_lizicheng', 'lu_xiang_sheng', 'li_zicheng', 'military_adversary', '天雄军剿寇', false, 8,
    '卢象升以文臣治军，所部号「天雄军」，崇祯间转战中原，屡破高迎祥、李自成诸部。流寇之未即渡河而北，象升之力为多。',
    [MS, '卷二百六十一·卢象升传'], { startYear: 1634, endYear: 1638 }),

  rb('ymq_luxiangsheng_duoergun', 'lu_xiang_sheng', 'duo_ergun', 'military_adversary', '巨鹿贾庄战死', false, 8,
    '崇祯十一年清军分道入塞，卢象升受命督师，兵不满二万，为杨嗣昌、高起潜所掣肘。十二月战于巨鹿贾庄，身中四矢三刃而死。',
    [MS, '卷二百六十一·卢象升传'], { startYear: 1638, endYear: 1639 }),

  rb('ymq_qinliangyu_zhuyoujian', 'qin_liang_yu', 'zhu_youjian', 'monarch_subject', '平台召见赐诗', true, 8,
    '崇祯三年清军入塞，秦良玉率白杆兵入援京师，崇祯帝召见平台，赐诗四章褒之，为明代女将所受之最隆礼遇。',
    [MS, '卷二百七十·秦良玉传'], { startYear: 1630, endYear: 1630 }),

  rb('ymq_qinliangyu_nuerhachi', 'qin_liang_yu', 'nu_erhachi', 'military_adversary', '浑河血战', false, 8,
    '天启元年，秦良玉遣兄邦屏、弟民屏率白杆兵赴辽，血战于浑河，邦屏战死。此役明军以寡敌众，为辽事中最惨烈之一战。',
    [MS, '卷二百七十·秦良玉传'], { startYear: 1621, endYear: 1621 }),

  rb('ymq_shikefa_duoergun', 'shi_ke_fa', 'duo_ergun', 'political_rival', '致书劝降', false, 9,
    '弘光元年清军南下，多尔衮遗书史可法劝降，可法报书拒之，辞气凛然。是年四月扬州城破，可法不屈死。',
    [MS, '卷二百七十四·史可法传'], { startYear: 1645, endYear: 1645 }),

  rb('ymq_lidingguo_wusangui', 'li_ding_guo', 'wu_sangui', 'military_adversary', '磨盘山与缅甸之索', false, 9,
    '永历帝入缅后，李定国转战滇缅边境。顺治十六年磨盘山设伏重创吴三桂追兵；永历十六年吴三桂索帝于缅甸，缢杀于昆明，定国闻之愤郁而卒。',
    [QSG, '卷二百二十四·李定国传'], { startYear: 1659, endYear: 1662 }),

  /* ============================== 明遗民 ============================== */
  rb('ymq_huangzongxi_zhuyoujian', 'huang_zong_xi', 'zhu_youjian', 'monarch_subject', '忠臣孤子', true, 7,
    '黄宗羲父黄尊素死于魏忠贤之狱。崇祯元年宗羲怀长锥入京讼冤，会审时锥刺仇人许显纯，思宗闻而叹曰「忠臣孤子」，一时名动京师。',
    [QSG, '卷四百八十·儒林一'], { startYear: 1628, endYear: 1628 }),

  rb('ymq_wangfuzhi_wusangui', 'wang_fu_zhi', 'wu_sangui', 'political_rival', '拒劝进', false, 8,
    '吴三桂据云南后曾使人招王夫之，欲其劝进，夫之拒之，遁入山中。此后四十年不剃发、不与官方往来，闭门著书于石船山。',
    [QSG, '卷四百八十·儒林一'], { startYear: 1673, endYear: 1678 }),

  rb('ymq_huangzongxi_wangfuzhi', 'huang_zong_xi', 'wang_fu_zhi', 'political_ally', '遗民同调（并置）', false, 6,
    '二人终身未曾谋面。此边为并置而非交往：同入《清史稿·儒林一》，同为明遗民而不仕清，学术取径亦相近（皆斥空谈心性），故并列以见一代学风。',
    [QSG, '卷四百八十·儒林一'], { startYear: 1650, endYear: 1692 }),

  rb('ymq_guyanwu_xuanye', 'gu_yan_wu', 'xuan_ye', 'monarch_subject', '屡征不起', false, 6,
    '康熙间诏举博学鸿儒、开明史馆，顾炎武皆辞不与；大学士熊赐履招之，以死辞。其嗣母王氏绝食殉国时遗命「无为异国臣子」，炎武终身守之。',
    [QSG, '卷四百八十一·儒林二'], { startYear: 1678, endYear: 1682 }),

  /* ============================ 清：后妃与宗室 ============================ */
  rb('ymq_xiaozhuang_huangtaiji', 'xiao_zhuang', 'huang_taiji', 'kinship_marriage', '帝后', false, 10,
    '孝庄为科尔沁贝勒寨桑之女，天命十年嫁皇太极为侧福晋，崇德元年封永福宫庄妃，生皇九子福临。',
    [QSG, '卷二百一十四·后妃传'], { startYear: 1625, endYear: 1643 }),

  rb('ymq_xiaozhuang_fulin', 'xiao_zhuang', 'fu_lin', 'kinship_blood', '母子·扶立', true, 10,
    '崇德八年太宗猝崩，豪格与多尔衮争立。孝庄周旋其间，终以福临即位、多尔衮摄政收局，顺治一朝调护于摄政王与幼帝之间。',
    [QSG, '卷二百一十四·后妃传'], { startYear: 1643, endYear: 1661 }),

  rb('ymq_xiaozhuang_xuanye', 'xiao_zhuang', 'xuan_ye', 'kinship_blood', '祖母·教养', true, 10,
    '顺治十八年世祖崩，圣祖八岁即位，孝庄以太后力主用四辅臣，后又助康熙擒鳌拜。三藩乱起，出内帑犒军，谕「毋以兵事扰民」。',
    [QSG, '卷二百一十四·后妃传'], { startYear: 1661, endYear: 1688 }),

  rb('ymq_xiaozhuang_duoergun', 'xiao_zhuang', 'duo_ergun', 'political_ally', '拥立福临·摄政', false, 9,
    '太宗崩后，多尔衮与豪格争立不下，终以立福临、多尔衮摄政妥协。孝庄与摄政王共处七年，清初政局赖此得定。',
    [QSG, '卷二百一十四·后妃传'], { startYear: 1643, endYear: 1650 }),

  rb('ymq_yixin_cixi', 'yi_xin', 'ci_xi', 'political_ally', '辛酉政变', false, 10,
    '咸丰十一年咸丰帝崩于热河，载垣、肃顺等八人受顾命。奕訢与慈禧合谋，于解送京途中擒肃顺等，改元同治，奕訢受封议政王。',
    [QSG, '卷二百二十一·诸王七'], { startYear: 1861, endYear: 1865 }),

  rb('ymq_yixin_guangxu', 'yi_xin', 'guang_xu', 'monarch_subject', '亲王当国·甲午复起', true, 7,
    '奕訢历同、光两朝，光绪十年因中法战事罢一切差使，闲居十年；甲午战败后复起，然已不能有所作为，四年后卒。',
    [QSG, '卷二百二十一·诸王七'], { startYear: 1875, endYear: 1898 }),

  /* ========================== 清：军机处与十全武功 ========================== */
  rb('ymq_zhangtingyu_yinzhen', 'zhang_ting_yu', 'yin_zhen', 'monarch_subject', '定军机处规制', true, 9,
    '雍正八年西北用兵，设军机房于隆宗门内，廷玉手定规制：常事用疏、要事用折，皆下军机处拟旨、御笔朱批。内阁之权自此移于军机处。',
    [QSG, '卷二百八十八·张廷玉传'], { startYear: 1730, endYear: 1735 }),

  rb('ymq_zhangtingyu_hongli', 'zhang_ting_yu', 'hong_li', 'monarch_subject', '配享太庙', true, 8,
    '雍正崩，廷玉与鄂尔泰同受顾命。乾隆十四年以老病致仕，因求「配享太庙」之券为乾隆所斥、削伯爵；身后仍遵雍正遗诏配享，为清代汉臣中唯一一人。',
    [QSG, '卷二百八十八·张廷玉传'], { startYear: 1735, endYear: 1755 }),

  rb('ymq_fuheng_hongli', 'fu_heng', 'hong_li', 'monarch_subject', '直军机处二十三年', true, 9,
    '傅恒直军机处二十三年，日侍左右，以勤慎得上眷。乾隆尝谓「讷亲在朝，培养陶成，得一傅恒」，倚为社稷臣。',
    [QSG, '卷三百零一·傅恒传'], { startYear: 1748, endYear: 1770 }),

  rb('ymq_fukangan_fuheng', 'fu_kang_an', 'fu_heng', 'kinship_blood', '父子', true, 10,
    '福康安为傅恒第三子。傅恒本传末列四子：福灵安、福隆安、福康安、福长安，并注「福康安自有传」。',
    [QSG, '卷三百零一·傅恒传'], { startYear: 1754, endYear: 1770 }),

  rb('ymq_fukangan_hongli', 'fu_kang_an', 'hong_li', 'monarch_subject', '殊宠·十全武功', true, 9,
    '福康安以勋戚入侍，二十岁即充军机大臣，历平金川、石峰堡、台湾、廓尔喀、苗民诸役，为乾隆「十全武功」之要角。卒后追赠郡王，为清代非宗室封王者仅有之一人。',
    [QSG, '卷三百三十·福康安传'], { startYear: 1772, endYear: 1796 }),

  rb('ymq_zhaohui_hongli', 'zhao_hui', 'hong_li', 'monarch_subject', '平回部·封公', true, 8,
    '兆惠黑水营被围三月而坚守不溃，终与富德合军追二酋至巴达克山，回部平。以功封一等武毅谋勇公，图形紫光阁，列第二。',
    [QSG, '卷三百一十三·兆惠传'], { startYear: 1755, endYear: 1764 }),

  rb('ymq_yuezhongqi_niangengyao', 'yue_zhong_qi', 'nian_gengyao', 'political_ally', '参赞军事', false, 8,
    '雍正元年青海罗卜藏丹津叛，抚远大将军年羹尧请以岳钟琪参赞军事。钟琪分道进剿，五十余日而青海平。',
    [QSG, '卷二百九十六·岳钟琪传'], { startYear: 1723, endYear: 1725 }),

  rb('ymq_yuezhongqi_hongli', 'yue_zhong_qi', 'hong_li', 'monarch_subject', '金川起用', true, 7,
    '岳钟琪雍正十年被劾夺爵下狱，乾隆二年释归。十三年大金川久攻不下，高宗命起用，钟琪以十三骑入勒乌围招降莎罗奔，事遂定。',
    [QSG, '卷二百九十六·岳钟琪传'], { startYear: 1748, endYear: 1754 }),

  /* ============================== 清代文苑 ============================== */
  rb('ymq_nalanxingde_xuanye', 'na_lan_xing_de', 'xuan_ye', 'monarch_subject', '一等侍卫扈从', true, 8,
    '性德康熙十五年成进士，授三等侍卫，累迁一等，常扈从圣祖南巡北狩。其《长相思》即作于扈从东巡出山海关途中。',
    [QSG, '卷四百八十四·文苑一'], { startYear: 1676, endYear: 1685 }),

  rb('ymq_daizhen_hongli', 'dai_zhen', 'hong_li', 'monarch_subject', '四库馆纂修·赐同进士出身', true, 7,
    '乾隆三十八年开四库全书馆，戴震以举人特召充纂修官，校《水经注》及自《永乐大典》辑出的古算经；四十年赐同进士出身，授翰林院庶吉士。',
    [QSG, '卷四百八十一·儒林二'], { startYear: 1773, endYear: 1777 }),

  rb('ymq_gongzizhen_linzexu', 'gong_zi_zhen', 'lin_zexu', 'political_ally', '送序赠行·同倡更法', false, 8,
    '道光十八年林则徐奉命赴广东查禁鸦片，龚自珍作《送钦差大臣侯官林公序》赠行，条陈禁烟、防夷、练兵诸事，力主「无武力何以胜之」。',
    [QSG, '卷四百八十六·文苑三'], { startYear: 1838, endYear: 1841 }),

  rb('ymq_weiyuan_linzexu', 'wei_yuan', 'lin_zexu', 'political_ally', '授《四洲志》', false, 9,
    '道光二十一年林则徐谪戍伊犁，途经京口与魏源夜谈，以所译《四洲志》及船炮图说相付。魏源据以扩为《海国图志》，倡「师夷长技以制夷」。',
    [QSG, '卷四百八十六·文苑三'], { startYear: 1841, endYear: 1852 }),

  /* ============================== 太平天国 ============================== */
  rb('ymq_hongxiuquan_yangxiuqing', 'hong_xiu_quan', 'yang_xiu_qing', 'monarch_subject', '东王掌军政', true, 10,
    '杨秀清以「天父下凡」附体传言取得代天父传言之权，封东王、正军师，掌握军政实权。定都天京后诸王禀事皆须经东王，天王深居宫中。',
    [QSG, '卷四百七十五·洪秀全传'], { startYear: 1848, endYear: 1856 }),

  rb('ymq_yangxiuqing_shidakai', 'yang_xiu_qing', 'shi_da_kai', 'political_rival', '天京事变·逼走翼王', false, 9,
    '咸丰六年杨秀清逼封万岁，洪秀全密诏韦昌辉回京。韦昌辉围东王府，杀秀清及其部属二万余人。石达开自湖北回京责其滥杀，几为所害，缒城出走，全家遇难。',
    [QSG, '卷四百七十五·洪秀全传'], { startYear: 1856, endYear: 1856 }),

  rb('ymq_hongxiuquan_shidakai', 'hong_xiu_quan', 'shi_da_kai', 'monarch_subject', '翼王', true, 8,
    '石达开年二十参加金田起义，后封翼王。咸丰四、五年间督师西征，于九江、湖口两败湘军，曾国藩座船被夺，几欲自沉。',
    [QSG, '卷四百七十五·洪秀全传'], { startYear: 1851, endYear: 1856 }),

  rb('ymq_hongxiuquan_lixiucheng', 'hong_xiu_quan', 'li_xiu_cheng', 'monarch_subject', '忠王', true, 9,
    '李秀成咸丰十年再破江南大营，乘胜东取苏常，封忠王，主持苏浙军政。同治三年天京陷，护幼主突围，以己马让之，自骑劣马被俘。',
    [QSG, '卷四百七十五·洪秀全传'], { startYear: 1858, endYear: 1864 }),

  rb('ymq_hongxiuquan_zengguofan', 'hong_xiu_quan', 'zeng_guofan', 'military_adversary', '湘军剿太平天国', false, 10,
    '咸丰二年前后曾国藩练湘军于湖南，与太平军鏖战十余年。同治三年湘军破天京，太平天国亡。二人虽终身未谋面，而互为生死之敌。',
    [QSG, '卷四百七十五·洪秀全传'], { startYear: 1853, endYear: 1864 }),

  rb('ymq_lixiucheng_zengguofan', 'li_xiu_cheng', 'zeng_guofan', 'military_adversary', '天京陷·囚中作《自述》', false, 9,
    '同治三年六月天京陷，李秀成被俘至曾国藩营中。国藩令其书写供词，即数万言之《李秀成自述》；写毕即被杀于南京。',
    [QSG, '卷四百七十五·洪秀全传'], { startYear: 1864, endYear: 1864 }),

  /* ============================== 洋务与海军 ============================== */
  rb('ymq_dingruchang_lihongzhang', 'ding_ru_chang', 'li_hongzhang', 'monarch_subject', '北洋海军提督', true, 9,
    '丁汝昌本淮军陆将，光绪五年李鸿章奏调其办理北洋海防，赴英接舰，遂转为海军。十四年北洋海军成军，汝昌为提督，凡军中大计皆禀李大臣。',
    [QSG, '卷四百六十二·丁汝昌传'], { startYear: 1879, endYear: 1895 }),

  rb('ymq_dengshichang_dingruchang', 'deng_shi_chang', 'ding_ru_chang', 'monarch_subject', '致远管带', true, 8,
    '邓世昌为福建船政学堂首届毕业生，后调北洋，任致远快船管带，隶北洋海军提督丁汝昌麾下。黄海海战中致远沉没，世昌与全舰二百余人同殉。',
    [QSG, '卷四百六十·邓世昌传'], { startYear: 1888, endYear: 1894 }),
];
