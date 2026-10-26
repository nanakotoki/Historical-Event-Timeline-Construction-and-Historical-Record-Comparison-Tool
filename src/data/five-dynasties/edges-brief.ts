/**
 * 分片 · 五代十国 关系连线
 * ------------------------------------------------------------------
 * 46 人、跨 907–979 七十余年，人均度数刻意压在 2.6 上下：
 * 这一片真正的关系网是「梁晋夹河」「晋汉周禅代」「中原与十国」三张网，
 * 硬凑密度只会把政敌写成盟友。
 *
 * **三处须留底的措辞：**
 *  1. 刘龑立马氏为后，《新五代史》只称「马皇后」，《十国春秋》系为楚王马殷之女，
 *     故姻亲一说存异文，summary 中两说并出，不取其一。
 *  2. 闽与吴越、闽与中原的关系，只写「奉正朔、遣使入贡」这类可核之事，
 *     不编「结盟」「共击」。
 *  3. 荆南扼江陵而截诸国贡赋，楚、南平由是构兵，事见《新五代史·南平世家》，
 *     但具体战役年份两书记载不一，故不给 startYear。
 */
import { rb } from '../_helpers';

const JIUS = '《旧五代史》';
const XINW = '《新五代史》';
const XHP = '《宣和画谱》';
const SS = '《宋史》';

export const fiveDynBriefEdges = [
  /* ============================ 后梁 ============================ */
  rb('fd_yz_jx', 'zhu_youzhen', 'jing_xiang', 'monarch_subject', '君臣', true, 9,
    '敬翔自朱温时参预机务三十余年，友贞即位后仍居相位。然赵岩、张汉杰用事，翔言多不见听，梁亡遂自缢。',
    [XINW, '梁臣传·敬翔'], { startYear: 913, endYear: 923 }),
  rb('fd_yz_wyz', 'zhu_youzhen', 'wang_yanzhang', 'monarch_subject', '君臣', true, 8,
    '彦章为梁末第一勇将，末帝用之而復疑之，使监军掣其肘；中都之败，实兵少粮尽而非战之罪。',
    [XINW, '卷三十二·死节传'], { startYear: 915, endYear: 923 }),
  rb('fd_yz_lx', 'zhu_youzhen', 'liu_xun', 'monarch_subject', '君臣而终见杀', true, 7,
    '刘鄩为梁宿将，末帝信段凝之谗，遣使鸩之。杀一将而梁之方面无人，识者知其将亡。',
    [XINW, '梁臣传·刘鄩'], { startYear: 915, endYear: 921 }),
  rb('fd_yz_zqy', 'zhu_youzhen', 'zhang_quanyi', 'monarch_subject', '君臣', true, 7,
    '张全义以河南尹事梁，掌洛阳财赋，末帝倚为根本。梁亡后归后唐，仍领其地。',
    [XINW, '杂传·张全义'], { startYear: 913, endYear: 923 }),
  rb('fd_jx_wyz', 'jing_xiang', 'wang_yanzhang', 'political_ally', '同朝共事', false, 5,
    '二人同为梁室柱石：一在帷幄，一在行间。敬翔主战而不掌兵，彦章能战而受制于监军，梁之亡坐此。',
    [XINW, '梁臣传·敬翔']),
  rb('fd_lx_wyz', 'liu_xun', 'wang_yanzhang', 'political_ally', '同为梁将', false, 5,
    '刘鄩以持重名，王彦章以骁勇名，皆梁末仅存之良将，而先后死于非命。',
    [XINW, '梁臣传·刘鄩']),
  rb('fd_wyz_cx', 'wang_yanzhang', 'li_cunxu', 'military_adversary', '中都之战', false, 8,
    '彦章兵少，退保中都，为晋军所破。存勖亲解其缚、许以高官，彦章曰「岂有朝事梁而暮事晋者」，遂遇害。',
    [XINW, '卷三十二·死节传'], { startYear: 923, endYear: 923 }),
  rb('fd_lx_cx', 'liu_xun', 'li_cunxu', 'military_adversary', '夹河相持', false, 7,
    '梁晋夹河之战，刘鄩为梁军主帅，与李存勖相持经年。存勖尝叹「刘鄩一步百计」，终不能破。',
    [XINW, '梁臣传·刘鄩'], { startYear: 915, endYear: 916 }),
  rb('fd_zqy_sy', 'zhang_quanyi', 'li_siyuan', 'monarch_subject', '归事后唐', true, 6,
    '梁亡，张全义迎后唐庄宗于洛阳，仍为河南尹。明宗朝封齐王，同光四年卒。',
    [XINW, '杂传·张全义'], { startYear: 923, endYear: 926 }),

  /* ============================ 沙陀与后唐 ============================ */
  /* 李克用不在此处：他已在《隋唐》分片以 person_li_keyong 立传（唐末晋王），
     本片不再重复立目，否则同一人会有两个节点。他与存勖、嗣源、存孝诸人的父子、
     义儿关系，读者在隋唐片点开即可见；本片只补「同为义儿」这一层横向关系，
     把存孝接回图中，不至成孤点。 */
  rb('fd_cxiao_cx', 'li_cunxiao', 'li_cunxu', 'kinship_blood', '同为李克用义儿', false, 6,
    '存孝与存勖同为李克用养子，年辈相若而早死（存孝卒于 894 年，时存勖九岁）。此处只记同帐之义，不谓交游。',
    [XINW, '卷三十六·义儿传'], { startYear: 890, endYear: 894 }),
  rb('fd_cxiao_sy', 'li_cunxiao', 'li_siyuan', 'kinship_blood', '同为李克用义儿', false, 6,
    '二人同列李克用义儿。存孝以勇著而死于车裂，嗣源以谨厚终至为帝，晋军诸义儿之结局，以此为两极。',
    [XINW, '卷三十六·义儿传'], { startYear: 890, endYear: 894 }),
  rb('fd_cx_sy', 'li_cunxu', 'li_siyuan', 'political_rival', '义兄弟而相图', false, 8,
    '二人自幼同帐，柏乡、灭梁并肩而战。同光末邺都兵变，嗣源为乱军所拥，存勖自将讨之而军溃，遂死于兴教门。',
    [XINW, '卷六·唐本纪第六'], { startYear: 908, endYear: 926 }),
  rb('fd_cx_gct', 'li_cunxu', 'guo_chongtao', 'monarch_subject', '君臣', true, 9,
    '崇韬为庄宗枢密使，定策直趋汴州，八日灭梁。同光三年伐蜀，功高而为宦官所谗，庄宗遣使杀之。',
    [XINW, '唐臣传·郭崇韬'], { startYear: 923, endYear: 926 }),
  rb('fd_cx_zdw', 'li_cunxu', 'zhou_dewei', 'monarch_subject', '君臣', true, 7,
    '德威事晋两世。胡柳陂之役，存勖轻敌先进，德威父子力战俱没，晋军为之夺气。',
    [XINW, '唐臣传·周德威'], { startYear: 908, endYear: 919 }),
  rb('fd_cx_zcy', 'li_cunxu', 'zhang_chengye', 'monarch_subject', '力谏称帝', true, 7,
    '存勖欲称帝，承业泣谏以为「诸侯血战，本为唐室」，不听，遂不食而卒。',
    [XINW, '卷三十八·宦者传'], { startYear: 921, endYear: 922 }),
  rb('fd_sy_ck', 'li_siyuan', 'li_congke', 'kinship_blood', '养父子', true, 9,
    '从珂本姓王，明宗养以为子。明宗崩后，从珂自凤翔起兵入洛，尽杀闵帝一系。',
    [XINW, '卷七·唐本纪第七'], { startYear: 900, endYear: 933 }),
  rb('fd_sy_sjt', 'li_siyuan', 'shi_jingtang', 'kinship_marriage', '岳婿', true, 9,
    '石敬瑭娶明宗女永宁公主，为明宗朝河东节度使。明宗崩后，敬瑭遂以河东之兵反末帝。',
    [XINW, '卷八·晋本纪第八'], { startYear: 926, endYear: 933 }),
  rb('fd_sy_fd', 'li_siyuan', 'feng_dao', 'monarch_subject', '君臣', true, 7,
    '明宗朝冯道为相，明宗问以民间疾苦，道诵聂夷中《伤田家》诗，明宗为之动容。',
    [XINW, '杂传·冯道'], { startYear: 926, endYear: 933 }),
  rb('fd_cx_fd', 'li_cunxu', 'feng_dao', 'monarch_subject', '君臣', true, 7,
    '庄宗朝冯道为户部侍郎、翰林学士。庄宗遇弑，道率百官迎明宗于邺。',
    [XINW, '杂传·冯道'], { startYear: 923, endYear: 926 }),
  rb('fd_gct_mzx', 'guo_chongtao', 'meng_zhixiang', 'monarch_subject', '伐蜀主帅与留后', true, 7,
    '同光三年崇韬为招讨使伐前蜀，孟知祥为成都尹、西川节度副使，随军而行；蜀平后知祥留镇成都。',
    [XINW, '卷六十四·后蜀世家第四'], { startYear: 925, endYear: 926 }),

  /* ============================ 后晋 ============================ */
  rb('fd_sjt_swh', 'shi_jingtang', 'sang_weihan', 'monarch_subject', '谋主', true, 9,
    '敬瑭谋反迟疑，维翰与刘知远力劝，遂定割地称臣之策。后晋立国，维翰居功第一，两度为相。',
    [XINW, '晋臣传·桑维翰'], { startYear: 936, endYear: 942 }),
  rb('fd_sjt_lzy', 'shi_jingtang', 'liu_zhiyuan', 'monarch_subject', '心腹', true, 8,
    '刘知远为敬瑭亲将，掌亲军。敬瑭谋反，知远与桑维翰同为赞画；后晋立国，累官河东节度使。',
    [XINW, '卷十·汉本纪第十'], { startYear: 936, endYear: 942 }),
  rb('fd_sjt_scg', 'shi_jingtang', 'shi_chonggui', 'kinship_blood', '叔侄而养为子', true, 9,
    '重贵为敬瑭兄敬儒之子，敬瑭养为己子。天福七年敬瑭卒，重贵嗣位，是为出帝。',
    [XINW, '卷九·晋本纪第九'], { startYear: 914, endYear: 942 }),
  rb('fd_scg_jyg', 'shi_chonggui', 'jing_yanguang', 'monarch_subject', '君臣', true, 8,
    '出帝即位，景延广与李崧同受顾命。延广力主改称臣为称孙，遂启契丹连年南侵之端。',
    [XINW, '晋臣传·景延广'], { startYear: 942, endYear: 946 }),
  rb('fd_scg_swh', 'shi_chonggui', 'sang_weihan', 'monarch_subject', '君臣而见疏', true, 6,
    '出帝初仍用维翰为相，后因景延广之议与之不合，罢其政事。契丹入汴，维翰死于张彦泽之手。',
    [XINW, '晋臣传·桑维翰'], { startYear: 942, endYear: 947 }),
  rb('fd_jyg_swh', 'jing_yanguang', 'sang_weihan', 'political_rival', '和战之争', false, 7,
    '维翰主事契丹以保国，延广主绝之以雪耻。两策各执一端，而晋之兵力不足副其言，遂至国亡。',
    [XINW, '晋臣传·景延广'], { startYear: 942, endYear: 946 }),
  rb('fd_sjt_lck', 'shi_jingtang', 'li_congke', 'political_rival', '河东之叛', false, 8,
    '末帝忌敬瑭兵强，命移镇郓州。敬瑭遂反，割燕云十六州求救于契丹，后唐由是而亡。',
    [XINW, '卷八·晋本纪第八'], { startYear: 936, endYear: 937 }),

  /* ============================ 后汉 ============================ */
  rb('fd_lzy_shz', 'liu_zhiyuan', 'shi_hongzhao', 'monarch_subject', '君臣', true, 8,
    '史弘肇少为知远亲将，后汉立国授侍卫亲军马步军都指挥使，总领禁军，京师赖以不乱。',
    [XINW, '汉臣传·史弘肇'], { startYear: 947, endYear: 948 }),
  rb('fd_lzy_yb', 'liu_zhiyuan', 'yang_bin', 'monarch_subject', '君臣', true, 8,
    '杨邠为知远都押牙，委以心腹。后汉立国拜相兼枢密使，事无大小皆决于邠。',
    [XINW, '汉臣传·杨邠'], { startYear: 947, endYear: 948 }),
  rb('fd_lzy_gw', 'liu_zhiyuan', 'guo_wei_fd', 'monarch_subject', '君臣', true, 8,
    '郭威以军功为知远所重，后汉立国授枢密使，掌兵柄。知远临终以隐帝托之于杨邠、郭威等。',
    [XINW, '卷十一·周本纪第十一'], { startYear: 947, endYear: 948 }),
  rb('fd_lzy_lc', 'liu_zhiyuan', 'liu_chong', 'kinship_blood', '从兄弟', true, 8,
    '刘崇为知远从弟，后汉立国授河东节度使、太原尹，镇守故地。知远一系既亡，崇遂据太原自立。',
    [XINW, '卷七十·东汉世家第十'], { startYear: 947, endYear: 948 }),
  rb('fd_shz_yb', 'shi_hongzhao', 'yang_bin', 'political_ally', '同秉朝政', false, 7,
    '杨邠掌机务、史弘肇总宿卫、王章理财赋，三人共持后汉之政，亦同见忌于隐帝，同日被杀于广政殿。',
    [XINW, '汉臣传·史弘肇'], { startYear: 948, endYear: 950 }),
  rb('fd_shz_gw', 'shi_hongzhao', 'guo_wei_fd', 'political_ally', '同被猜忌', false, 6,
    '三人既死，朝中无可制郭威者。郭威在邺闻变，遂举兵南下，后汉旋亡。',
    [XINW, '卷十一·周本纪第十一'], { startYear: 950, endYear: 951 }),

  /* ============================ 后周 ============================ */
  rb('fd_gw_cr', 'guo_wei_fd', 'chai_rong', 'kinship_blood', '养父子', true, 10,
    '柴荣为郭威妻侄，幼养于郭威，遂以为子。显德元年郭威卒，荣嗣位，是为世宗。',
    [XINW, '卷十二·周本纪第十二'], { startYear: 921, endYear: 954 }),
  rb('fd_cr_wp', 'chai_rong', 'wang_pu', 'monarch_subject', '谋主', true, 9,
    '王朴上《平边策》，定先南后北之序，世宗用之。南征之役，朴居中调度，世宗倚为股肱。',
    [XINW, '周臣传·王朴'], { startYear: 955, endYear: 959 }),
  rb('fd_cr_zyd', 'chai_rong', 'zhang_yongde', 'monarch_subject', '君臣', true, 7,
    '高平之战周军右翼溃，张永德与赵匡胤各率所部力战，遂反败为胜。世宗整军，殿前诸班之制多出其手。',
    [XINW, '周臣传·张永德'], { startYear: 954, endYear: 959 }),
  rb('fd_wp_zyd', 'wang_pu', 'zhang_yongde', 'political_ally', '同朝', false, 5,
    '王朴主谋议，张永德典禁军，同为世宗一朝之柱石。',
    [XINW, '周臣传·王朴']),
  rb('fd_cr_ct', 'chai_rong', 'chen_tuan', 'monarch_subject', '召问黄白', false, 6,
    '显德中世宗召陈抟问黄白之术，抟对曰「陛下为四海之主，当以治天下为念，奈何留意黄白之事」，世宗不罪，放还山。',
    [SS, '卷四百五十七·隐逸传上·陈抟']),
  rb('fd_cr_lc', 'chai_rong', 'liu_chong', 'military_adversary', '高平之战', false, 9,
    '刘崇乘郭威之丧，合契丹兵南下，世宗亲征，战于高平。北汉军大溃，崇仅以身免。',
    [XINW, '卷七十·东汉世家第十'], { startYear: 954, endYear: 954 }),
  rb('fd_gw_lc', 'guo_wei_fd', 'liu_chong', 'political_rival', '代汉之仇', false, 7,
    '郭威代汉建周，刘崇遂称帝于太原，仍用乾祐年号，遣使称侄于契丹以求援兵。',
    [XINW, '卷七十·东汉世家第十'], { startYear: 951, endYear: 954 }),
  rb('fd_cr_lj', 'chai_rong', 'li_jing_fd', 'military_adversary', '三征南唐', false, 8,
    '显德二年至五年，周军三度南征，取江北十四州。南唐去帝号称国主，尽献江北之地。',
    [XINW, '卷六十二·南唐世家第二'], { startYear: 955, endYear: 958 }),
  rb('fd_gw_fd', 'guo_wei_fd', 'feng_dao', 'monarch_subject', '君臣', true, 7,
    '郭威代汉，冯道率百官劝进。周初仍以道为太师、中书令，礼遇不衰。',
    [XINW, '杂传·冯道'], { startYear: 951, endYear: 954 }),
  rb('fd_cr_fd', 'chai_rong', 'feng_dao', 'monarch_subject', '君臣', true, 7,
    '世宗欲亲征北汉，冯道力谏以为不可，世宗曰「唐太宗之征，皆亲行」，道曰「未审陛下能为唐太宗否」，世宗怒，遂罢其相。',
    [XINW, '杂传·冯道'], { startYear: 954, endYear: 954 }),

  /* ============================ 十国 ============================ */
  rb('fd_yxm_xw', 'yang_xingmi', 'xu_wen', 'monarch_subject', '部将与顾命', true, 8,
    '徐温自杨行密起兵时即为右牙指挥使，行密临终与张颢同受顾命。行密卒后，吴政遂归徐氏。',
    [XINW, '卷六十一·吴世家第一'], { startYear: 892, endYear: 905 }),
  rb('fd_xw_lb', 'xu_wen', 'li_bian', 'kinship_blood', '养父子', true, 9,
    '李昪本名徐知诰，为徐温养子。温专吴政二十余年，卒后知诰继其权，终受吴禅而建南唐。',
    [XINW, '卷六十二·南唐世家第二'], { startYear: 895, endYear: 927 }),
  rb('fd_lb_lj', 'li_bian', 'li_jing_fd', 'kinship_blood', '父子', true, 10,
    '李璟为李昪长子。升元七年昪卒，璟嗣位，改元保大，南唐之盛极于此而衰亦始于此。',
    [XINW, '卷六十二·南唐世家第二'], { startYear: 916, endYear: 943 }),
  rb('fd_lj_ly', 'li_jing_fd', 'li_yu_fd', 'kinship_blood', '父子', true, 10,
    '李煜为李璟第六子，诸兄早卒而得立。建隆二年璟卒于南都，煜于金陵即位。',
    [XINW, '卷六十二·南唐世家第二'], { startYear: 937, endYear: 961 }),
  rb('fd_ly_hxz', 'li_yu_fd', 'han_xizai', 'monarch_subject', '君臣', true, 8,
    '后主欲相韩熙载，以其帷薄不修而止。熙载卒，后主为之辍朝，叹曰「吾终不得相之矣」。',
    ['《南唐书》', '韩熙载传'], { startYear: 961, endYear: 970 }),
  rb('fd_ly_ghz', 'li_yu_fd', 'gu_hongzhong', 'monarch_subject', '君臣', true, 7,
    '后主疑韩熙载纵逸，命画院待诏顾闳中夜至其第窥之，图其觞咏之状以进，是为《韩熙载夜宴图》。',
    [XHP, '人物·顾闳中'], { startYear: 964, endYear: 970 }),
  rb('fd_hxz_ghz', 'han_xizai', 'gu_hongzhong', 'literary_bosom', '画中主角与被绘者', false, 6,
    '二人非诗酒之交，而是「被画者」与「奉命作画者」。顾闳中夜窥其宴，默记成图，遂使韩熙载之名藉画而传千年。',
    [XHP, '人物·顾闳中']),
  rb('fd_lj_dy', 'li_jing_fd', 'dong_yuan', 'monarch_subject', '君臣', true, 6,
    '董源事南唐为北苑副使，元宗、后主两朝皆在画院，江南山水一派以之为宗。',
    [XHP, '山水·董源']),
  rb('fd_dy_jr', 'dong_yuan', 'ju_ran', 'mentor_disciple', '师承', true, 8,
    '巨然为江宁开元寺僧，山水师董源，益以淡墨轻岚，后世并称「董巨」，为元明文人画之祖。',
    [XHP, '山水·巨然']),
  rb('fd_wj_wz', 'wang_jian_fd', 'wei_zhuang', 'monarch_subject', '君臣', true, 8,
    '韦庄入蜀佐王建，前蜀开国制度号令多出其手，官至吏部侍郎、同平章事。',
    [XINW, '卷六十三·前蜀世家第三'], { startYear: 907, endYear: 910 }),
  rb('fd_mzx_hq', 'meng_zhixiang', 'huang_quan_fd', 'monarch_subject', '君臣', true, 6,
    '黄筌事王衍、孟知祥、孟昶三世，为后蜀画院待诏，后蜀画院之盛由其主持。',
    [XHP, '花鸟·黄筌'], { startYear: 934, endYear: 934 }),
  rb('fd_ly_mi', 'liu_yan_fd', 'ma_yin', 'kinship_marriage', '姻亲', false, 6,
    '刘龑立马氏为皇后。《新五代史》只称「马皇后」，《十国春秋》则系为楚王马殷之女——两说并存，故只记「立马氏为后」，不坐实为马殷女。',
    [XINW, '卷六十五·南汉世家第五'], { startYear: 917, endYear: 930 }),
  rb('fd_ql_lym', 'qian_liu', 'luo_yin', 'monarch_subject', '幕主与文士', true, 7,
    '罗隐晚归两浙，钱镠辟为从事，历钱塘令、给事中。镠好其诗，遇事多所咨访。',
    [XINW, '卷六十七·吴越世家第七'], { startYear: 896, endYear: 909 }),
  rb('fd_ql_yxm', 'qian_liu', 'yang_xingmi', 'military_adversary', '吴越与吴争苏常', false, 8,
    '钱镠与杨行密夹江而国，苏、常、润诸州屡相攻取。两浙之得以偏安，正在于始终未被吴并。',
    [XINW, '卷六十七·吴越世家第七'], { startYear: 892, endYear: 905 }),
  rb('fd_mi_gjx', 'ma_yin', 'gao_jixing', 'military_adversary', '贡道之争', false, 5,
    '荆南扼江陵，诸国入贡中原者多被截留，楚与南平屡以是构兵。事见《南平世家》，而战役年份两书记载不一。',
    [XINW, '卷六十九·南平世家第九']),
  rb('fd_gsz_cx', 'wang_shenzhi', 'li_cunxu', 'monarch_subject', '奉正朔', true, 6,
    '闽居海隅，终审知之世奉中原正朔。后唐灭梁，审知遣使入贡，受其册命，而不自僭号。',
    [XINW, '卷六十八·闽世家第八'], { startYear: 923, endYear: 925 }),

  /* ============================ 文苑与方外 ============================ */
  /* 韦庄与李璟、罗隐与韦庄，皆「不相及而并称」之类，本片只写后一条：
     罗隐（833–909）与韦庄（836–910）同为唐末诗人，年辈相接而史传无交游之迹，
     故明写「并称」而不写「交往」。韦庄与李璟相差一辈，连并称都勉强，遂不立边。 */
  rb('fd_lym_wz', 'luo_yin', 'wei_zhuang', 'literary_bosom', '唐末诗坛并称', false, 4,
    '二人皆唐末诗人而不相得：罗隐十上不第、终老幕府，韦庄年近六十始登第而位至宰相。此处只记诗坛并称，不假造交游。',
    ['《唐才子传》', '罗隐传、韦庄传']),
];
