/**
 * 分片 · 宋元明清 · 补遗连线（辽、金、西夏 + 宋方三人）
 * ------------------------------------------------------------------
 * 补这一批的动机写在 persons-liao-jin-xia.ts 的头部：原图只有宋方，没有对手方。
 * 所以这批边的大头是**跨政权的军事对抗边**，而不是内部宗族边——
 * 内部边只求不落孤点，跨政权边才是这次要补的戏。
 *
 * 三条纪律：
 *  1. **已有边不重连。** 萧绰—赵恒（澶渊）、宗弼—岳飞（郾城）、宗弼—赵构（搜山检海）、
 *     完颜亮—完颜雍（辽阳代立）、完颜雍—赵昚（隆兴和议）五条原本就有，此处绕开，
 *     改从另外的当事人切入（如采石之战改连虞允文—完颜亮，因为督战的是虞允文）。
 *  2. **不相及者不硬连。** 完颜璟即位于 1189，纥石烈志宁卒于 1172，二人不同世，
 *     故志宁一系只连世宗；李仁孝生于 1124，李谅祚卒于 1068，隔三代，只连同时的金世宗。
 *  3. **议和类边 directed=false。** 澶渊、绍兴、隆兴都不是单向的君臣关系，
 *     是两政权之间的对等往来，写成有向边会误导读图。
 */
import { rb } from '../_helpers';

const LS = '《辽史》';
const JS = '《金史》';
const SS = '《宋史》';

export const songWarEdges = [
  /* ========================= 辽：宗室、后族与宋 ========================= */
  rb('ljx_abaoji_shulv', 'ye_lu_abaoji', 'shu_lv_ping', 'kinship_marriage', '帝后', false, 10,
    '述律平为耶律阿保机皇后，佐其统一契丹诸部、建契丹国。太祖用兵中原、西征室韦，述律平多预其谋。',
    [LS, '卷七十一·后妃传'], { startYear: 907, endYear: 926 }),

  rb('ljx_shulv_deguang', 'shu_lv_ping', 'ye_lu_deguang', 'kinship_blood', '母子·称制立之', true, 9,
    '太祖崩后述律平称制，力主次子耶律德光即位，而令长子耶律倍出奔后唐。太宗一朝国政多承母命。',
    [LS, '卷七十一·后妃传'], { startYear: 926, endYear: 947 }),

  rb('ljx_chuo_longxu', 'xiao_chuo', 'ye_lu_long_xu', 'kinship_blood', '母子·摄政', true, 10,
    '隆绪十二岁即位，母萧绰以承天太后摄政二十七年，军国大事一决于太后，澶渊之盟即由太后主持。',
    [LS, '卷七十一·后妃传'], { startYear: 982, endYear: 1009 }),

  rb('ljx_longxu_han', 'ye_lu_long_xu', 'han_de_rang', 'monarch_subject', '大丞相', true, 9,
    '韩德让受景宗顾命，总宿卫、典禁军，圣宗朝官至大丞相，赐姓耶律、改名隆运，位在亲王之上。',
    [LS, '卷八十二·耶律隆运传'], { startYear: 982, endYear: 1011 }),

  rb('ljx_chuo_han', 'xiao_chuo', 'han_de_rang', 'political_ally', '共辅圣宗', false, 9,
    '景宗崩后，承天太后萧绰与韩德让共定大政，内外相维二十余年；澶渊议和的岁币数额与文书往还多由二人裁定。',
    [LS, '卷八十二·耶律隆运传'], { startYear: 982, endYear: 1009 }),

  rb('ljx_longxu_xiuge', 'ye_lu_long_xu', 'ye_lu_xiu_ge', 'monarch_subject', '南京留守', true, 8,
    '休哥镇燕京久，为圣宗朝南面屏障，统和十六年卒于任。',
    [LS, '卷八十三·耶律休哥传'], { startYear: 982, endYear: 998 }),

  rb('ljx_longxu_xiezhen', 'ye_lu_long_xu', 'ye_lv_xie_zhen', 'monarch_subject', '北院枢密使', true, 8,
    '斜轸为承天太后之侄，圣宗朝官至北院枢密使，为山西路都统。',
    [LS, '卷八十三·耶律斜轸传'], { startYear: 982, endYear: 999 }),

  rb('ljx_xiezhen_yangye', 'ye_lv_xie_zhen', 'yang_ye', 'military_adversary', '陈家谷擒杨业', false, 9,
    '雍熙三年宋西路出雁门，斜轸设伏于陈家谷，杨业力战被擒，不食而死。西路既溃，宋三路北伐全线瓦解。',
    [LS, '卷八十三·耶律斜轸传'], { startYear: 986, endYear: 986 }),

  rb('ljx_xiuge_taizong', 'ye_lu_xiu_ge', 'zhao_guangyi', 'military_adversary', '高梁河之战', false, 9,
    '太平兴国四年宋太宗灭北汉后乘胜攻辽南京，休哥与斜轸分道邀击于高梁河，宋军大溃，太宗乘驴车得脱。',
    [LS, '卷八十三·耶律休哥传'], { startYear: 979, endYear: 979 }),

  rb('ljx_talin_kouzhun', 'xiao_ta_lin', 'kou_zhun', 'military_adversary', '澶州中弩', false, 7,
    '统和二十二年辽军至澶州，挞凛率轻骑侦察城下，为宋军床子弩射杀。辽失主帅，加之孤军深入，遂与宋议和。',
    [LS, '卷八十五·萧挞凛传'], { startYear: 1004, endYear: 1004 }),

  rb('ljx_talin_chuo', 'xiao_ta_lin', 'xiao_chuo', 'kinship_blood', '族姐弟', false, 7,
    '挞凛为辽后族，承天太后萧绰之族弟，统和年间为南征大将。',
    [LS, '卷八十五·萧挞凛传'], { startYear: 990, endYear: 1004 }),

  rb('ljx_yanxi_aguda', 'ye_lv_yan_xi', 'wan_yan_aguda', 'military_adversary', '女真反辽', false, 9,
    '天庆四年完颜阿骨打起兵，辽军先后败于出河店、护步答冈，五京相继失守。天祚帝西走，终为金军所俘。',
    [LS, '卷二十七·天祚皇帝本纪一'], { startYear: 1114, endYear: 1125 }),

  rb('ljx_dashi_yanxi', 'ye_lv_da_shi', 'ye_lv_yan_xi', 'political_rival', '君臣相失', false, 6,
    '大石初为天祚帝辽兴军节度使。保大二年金军破南京，大石拥立耶律淳于燕京，天祚怒而责之，君臣自此分道。辽亡后大石西走，别建西辽。',
    [LS, '卷三十·天祚皇帝本纪四（附西辽）'], { startYear: 1115, endYear: 1125 }),

  /* ========================= 金：宗室、弑立与南征 ========================= */
  rb('ljx_aguda_zongwang', 'wan_yan_aguda', 'wan_yan_zong_wang', 'kinship_blood', '父子', true, 10,
    '宗望为太祖次子，从父灭辽，追击天祚帝于鸳鸯泺，后为灭宋东路军主帅。',
    [JS, '卷七十四·宗望传'], { startYear: 1114, endYear: 1123 }),

  rb('ljx_aguda_zonghan', 'wan_yan_aguda', 'wan_yan_zong_han', 'kinship_blood', '叔侄', true, 9,
    '宗翰为太祖之侄，本名粘没喝，从太祖起兵，为灭辽主将之一，终俘天祚帝于夹山。',
    [JS, '卷七十四·宗翰传'], { startYear: 1114, endYear: 1123 }),

  rb('ljx_aguda_xiyin', 'wan_yan_aguda', 'wan_yan_xi_yin', 'monarch_subject', '制女真大字', true, 8,
    '太祖命希尹制本国文字，希尹依汉楷、因契丹字制度，合本族语制成女真大字，天辅三年颁行。',
    [JS, '卷七十三·完颜希尹传'], { startYear: 1119, endYear: 1119 }),

  rb('ljx_zongwang_zonghan', 'wan_yan_zong_wang', 'wan_yan_zong_han', 'political_ally', '分道伐宋', false, 9,
    '天会三年金分两路攻宋：宗望出平州为东路，宗翰出云中为西路，次年会师汴京城下。',
    [JS, '卷七十四·宗翰传'], { startYear: 1125, endYear: 1127 }),

  rb('ljx_zonghan_xiyin', 'wan_yan_zong_han', 'wan_yan_xi_yin', 'monarch_subject', '右监军', false, 8,
    '天会年间希尹为右监军，从宗翰攻宋，为金初军政核心之一。',
    [JS, '卷七十三·完颜希尹传'], { startYear: 1125, endYear: 1135 }),

  rb('ljx_zonghan_dan', 'wan_yan_zong_han', 'wan_yan_dan', 'political_ally', '拥立熙宗', true, 9,
    '太宗崩后，宗翰与宗干等拥立太祖嫡孙完颜亶，是为熙宗。宗翰以国论右勃极烈专掌国政，权势倾朝。',
    [JS, '卷四·熙宗本纪'], { startYear: 1135, endYear: 1137 }),

  rb('ljx_dan_xiyin', 'wan_yan_dan', 'wan_yan_xi_yin', 'political_rival', '赐死', true, 8,
    '希尹与宗翰旧党相连，天眷三年为熙宗所杀。海陵王时追复官爵，谥贞宪。',
    [JS, '卷七十三·完颜希尹传'], { startYear: 1137, endYear: 1140 }),

  rb('ljx_dan_liang', 'wan_yan_dan', 'wan_yan_liang', 'political_rival', '弑君自立', false, 9,
    '皇统九年完颜亮弑熙宗于寝殿，自立为帝，是为海陵王。金室自太祖一系转入宗干一系。',
    [JS, '卷四·熙宗本纪'], { startYear: 1149, endYear: 1150 }),

  rb('ljx_jing_yong', 'wan_yan_jing', 'wan_yan_yong', 'kinship_blood', '祖孙', true, 8,
    '璟为世宗嫡孙，父完颜允恭早卒。大定二十九年世宗崩，璟即位，改元明昌。',
    [JS, '卷九·章宗本纪一'], { startYear: 1189, endYear: 1189 }),

  rb('ljx_yong_zhining', 'wan_yan_yong', 'he_shi_lie_zhi_ning', 'monarch_subject', '符离之捷', true, 9,
    '志宁于海陵时为其麾下，海陵被杀后归世宗，世宗不罪而用之。大定三年与仆散忠义合击宋军于符离，宋军大溃。',
    [JS, '卷八十七·纥石烈志宁传'], { startYear: 1161, endYear: 1172 }),

  rb('ljx_shouxu_chen', 'wan_yan_shou_xu', 'wan_yan_chen_heshang', 'monarch_subject', '擢忠孝军提控', true, 9,
    '陈和尚以勇略为哀宗所知，擢忠孝军提控。忠孝军多收河北亡命，素难制，陈和尚以严整御之，遂成劲旅。',
    [JS, '卷一百二十三·忠义传三'], { startYear: 1227, endYear: 1232 }),

  rb('ljx_chen_tuolei', 'wan_yan_chen_heshang', 'tuo_lei', 'military_adversary', '三峰山之战', false, 8,
    '天兴元年拖雷率蒙古军迂回南下，与金军主力战于钧州三峰山，金军大败，陈和尚被俘不屈死。',
    [JS, '卷一百二十三·忠义传三'], { startYear: 1232, endYear: 1232 }),

  rb('ljx_ruoxu_haowen', 'wang_ruo_xu', 'yuan_haowen', 'literary_bosom', '金末文脉', false, 7,
    '二人同以文名于金末，若虚长于经学文论，好问擅诗史。金亡后皆不仕新朝，一隐于藁城，一编《中州集》以存金源文献。',
    [JS, '卷一百二十六·文艺传下'], { startYear: 1200, endYear: 1243 }),

  /* ========================= 金与宋：靖康、采石、蔡州 ========================= */
  rb('ljx_zongwang_zhaoji', 'wan_yan_zong_wang', 'zhao_ji', 'military_adversary', '靖康之变', false, 10,
    '天会四年宗望与宗翰会师汴京城下，城破，俘宋徽宗、钦宗及宗室后妃工匠数千人北去，北宋亡。',
    [JS, '卷七十四·宗望传'], { startYear: 1126, endYear: 1127 }),

  rb('ljx_zonghan_zhaohuan', 'wan_yan_zong_han', 'zhao_huan', 'military_adversary', '汴京城破', false, 10,
    '宗翰率西路军破太原后南下，与宗望合围汴京。城破后钦宗被废为庶人，与徽宗同被押北行。',
    [JS, '卷七十四·宗翰传'], { startYear: 1126, endYear: 1127 }),

  rb('ljx_yunwen_liang', 'yu_yun_wen', 'wan_yan_liang', 'military_adversary', '采石之战', false, 10,
    '绍兴三十一年完颜亮举国南侵，允文以中书舍人犒师采石，集诸将、督舟师迎击，以海鳅船冲撞金舟，金军大败。未几完颜亮为部下所杀。',
    [SS, '卷三百八十三·虞允文传'], { startYear: 1161, endYear: 1161 }),

  rb('ljx_shouxu_menggong', 'wan_yan_shou_xu', 'meng_gong', 'military_adversary', '蔡州合围', false, 9,
    '天兴三年蒙古与南宋合兵围蔡州，孟珙率宋军参与攻城。城破，哀宗自缢，金亡。',
    [SS, '卷四百一十二·孟珙传'], { startYear: 1233, endYear: 1234 }),

  /* ============================= 西夏 ============================= */
  rb('ljx_jiqian_deming', 'li_ji_qian', 'li_de_ming', 'kinship_blood', '父子', true, 10,
    '继迁中流矢死，德明继领其众。德明两受宋辽封号，休养生息近三十年，为其子元昊称帝积蓄国力。',
    [SS, '卷四百八十五·外国二·夏国传上'], { startYear: 981, endYear: 1004 }),

  rb('ljx_jiqian_yuanhao', 'li_ji_qian', 'li_yuanhao', 'kinship_blood', '祖孙', true, 9,
    '元昊为继迁之孙、德明之子，继三世之业而称帝，国号大夏。',
    [SS, '卷四百八十五·外国二·夏国传上'], { startYear: 1004, endYear: 1038 }),

  rb('ljx_deming_yuanhao', 'li_de_ming', 'li_yuanhao', 'kinship_blood', '父子', true, 10,
    '德明卒，元昊继立，数年后废宋赐姓、改元称帝，宋夏战事自此起。',
    [SS, '卷四百八十五·外国二·夏国传上'], { startYear: 1004, endYear: 1032 }),

  rb('ljx_yuanhao_liangzuo', 'li_yuanhao', 'li_liang_zuo', 'kinship_blood', '父子', true, 10,
    '元昊遇弑时谅祚生甫周岁，遂即位，母没藏氏摄政，其兄没藏讹庞掌兵权。',
    [SS, '卷四百八十六·外国三·夏国传下'], { startYear: 1047, endYear: 1048 }),

  rb('ljx_jiqian_taizong', 'li_ji_qian', 'zhao_guangyi', 'military_adversary', '灵州之争', false, 8,
    '太平兴国七年继迁抗宋自立，北走地斤泽，此后连年扰宋边。至道三年宋授其定难军节度使，然实据故地；咸平五年攻取灵州，改称西平府。',
    [SS, '卷四百八十五·外国二·夏国传上'], { startYear: 982, endYear: 997 }),

  rb('ljx_renxiao_yong', 'li_ren_xiao', 'wan_yan_yong', 'political_ally', '夏金通好', false, 7,
    '仁孝在位时西夏与金通好，边境安息，国中号称富庶。金世宗亦以「南北讲好」自期，两国使节往还不绝。',
    [SS, '卷四百八十六·外国三·夏国传下'], { startYear: 1161, endYear: 1189 }),

  rb('ljx_xian_tiemuzhen', 'li_xian', 'tie_mu_zhen', 'military_adversary', '中兴府之围', false, 9,
    '宝义二年蒙古军围西夏都城中兴府，久攻不下，适逢地震、城中疫病，粮尽援绝。李睍出降，西夏亡。',
    [SS, '卷四百八十六·外国三·夏国传下'], { startYear: 1226, endYear: 1227 }),

  /* ======================== 宋方三人：和、战、守 ======================== */
  rb('ljx_fubi_zhenzong', 'fu_bi', 'zhao_zhen', 'monarch_subject', '使辽', true, 9,
    '庆历二年辽索关南十县地，富弼两度使辽，拒割地而许增岁币，且力争「献」「纳」二字不入国书，遂成庆历和议。',
    [SS, '卷三百一十三·富弼传'], { startYear: 1042, endYear: 1043 }),

  rb('ljx_fubi_fanzhongyan', 'fu_bi', 'fan_zhongyan', 'political_ally', '庆历新政', false, 8,
    '庆历三年仁宗以范仲淹为参知政事，富弼副之，同主「庆历新政」十事，未及一年而罢，二人同被外放。',
    [SS, '卷三百一十三·富弼传'], { startYear: 1043, endYear: 1045 }),

  rb('ljx_yunwen_zhaogou', 'yu_yun_wen', 'zhao_gou', 'monarch_subject', '采石督师', true, 8,
    '绍兴三十一年金军南侵，允文受命犒师采石，适主将罢去、军无统属，遂自任督战，高宗闻捷，南宋赖以转危为安。',
    [SS, '卷三百八十三·虞允文传'], { startYear: 1161, endYear: 1162 }),

  rb('ljx_chongshi_zhaohuan', 'chong_shi_dao', 'zhao_huan', 'monarch_subject', '西军勤王', true, 8,
    '靖康元年金兵南下，七十六岁的种师道率西军入援汴京。朝廷议割三镇求和，师道力谏「三镇不可弃」，又请屯兵河上断敌归路，皆不见用。',
    [SS, '卷三百三十五·种师道传'], { startYear: 1126, endYear: 1126 }),

  rb('ljx_chongshi_ligang', 'chong_shi_dao', 'li_gang', 'political_ally', '坚守之议', false, 8,
    '靖康元年汴京被围，李纲主守城，种师道主扼河待战，二人同排和议，然皆为朝议所格。',
    [SS, '卷三百三十五·种师道传'], { startYear: 1126, endYear: 1126 }),
];
