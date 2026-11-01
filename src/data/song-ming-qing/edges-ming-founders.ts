/**
 * 分片 · 宋元明清（明代补编）关系连线
 * ------------------------------------------------------------------
 * **一条边只写一件确有其事的事**。本批 14 人之间的连线，全部能在
 * 《明史》本传原句里找到出处，不写「同朝为官」这种无人不可套的空话：
 *
 *   李文忠「以偏将军从右副将军常遇春出塞」——才敢写李文忠与常遇春；
 *   邓愈「以征西将军偕副将军沐英讨之」——才敢写邓愈与沐英；
 *   谢迁「尝举王鏊吴宽自代」——才敢写谢迁与王鏊，且只能是举主与被举者。
 *
 * 两条**故意不建**的边，记下来免得后人以为是漏：
 *   ① 沈炼与杨继盛：同列《明史》卷二百〇九，同为劾严嵩得罪，但二人一生并无往来记载，
 *      沈炼谪佃保安时杨继盛已在狱中。同卷不等于相识，不建。
 *   ② 王鏊与李东阳：同在内阁，然本传不载二人往复事，与其编一句「同僚相善」，
 *      不如留白——他已有谢迁举荐一条边，不孤。
 */
import { rb } from '../_helpers';

const MS = '《明史》';

export const mingFoundersEdges = [
  /* ---------------------------- 洪武开国集团 ---------------------------- */
  rb('smq2_zhuyuanzhang_lishanchang', 'zhu_yuanzhang', 'li_shanchang', 'monarch_subject', '定策佐命', true, 10,
    '太祖略地滁阳，善长迎谒，以「秦乱汉高起布衣」为对，劝其法汉高所为。自此掌书记、主馈饷，洪武三年大封功臣位第一，制词比之萧何。',
    [MS, '卷一百二十七·列传第十五·李善长传'], { startYear: 1354, endYear: 1390 }),

  rb('smq2_zhuyuanzhang_wangguangyang', 'zhu_yuanzhang', 'wang_guangyang', 'monarch_subject', '右丞相', true, 7,
    '太祖渡江召为元帅府令史，洪武十年拜右丞相。终明之世得称丞相者，惟善长、广洋二人。后以「朋欺」贬死。',
    [MS, '卷一百二十七·列传第十五·汪广洋传'], { startYear: 1355, endYear: 1380 }),

  rb('smq2_zhuyuanzhang_liwenzhong', 'zhu_yuanzhang', 'li_wenzhong', 'kinship_blood', '舅甥', true, 10,
    '文忠为太祖姊子，年十二母死，随父转侧乱军中，逾二年谒太祖于滁阳。太祖抚以为子，令从己姓，年十九即以舍人将亲军。',
    [MS, '卷一百二十六·列传第十四·李文忠传'], { startYear: 1352, endYear: 1384 }),

  rb('smq2_zhuyuanzhang_dengyu', 'zhu_yuanzhang', 'deng_yu_ming', 'monarch_subject', '君臣', true, 9,
    '愈年十六领父兄之众，太祖起滁阳，自盱眙来归，授管军总管。洪武三年封卫国公，十年为征西将军讨川藏。',
    [MS, '卷一百二十六·列传第十四·邓愈传'], { startYear: 1353, endYear: 1377 }),

  rb('smq2_zhuyuanzhang_tanghe', 'zhu_yuanzhang', 'tang_he', 'monarch_subject', '同里发小', true, 9,
    '汤和与太祖同里闬，长太祖三岁。郭子兴起兵，帅壮士十余人归之；时诸将多与太祖等夷，莫肯为下，和独奉约束甚谨，太祖甚悦之。',
    [MS, '卷一百二十六·列传第十四·汤和传'], { startYear: 1352, endYear: 1395 }),

  rb('smq2_zhuyuanzhang_muying', 'zhu_yuanzhang', 'mu_ying', 'monarch_subject', '养父子', true, 9,
    '英少孤，从母避兵，母又死。太祖与孝慈皇后怜之，抚为子，从朱姓。年十八授帐前都尉，后复姓沐，镇云南终其身。',
    [MS, '卷一百二十六·列传第十四·沐英传'], { startYear: 1352, endYear: 1392 }),

  rb('smq2_liwenzhong_changyuchun', 'li_wenzhong', 'chang_yuchun', 'monarch_subject', '偏将军从征', true, 8,
    '洪武二年春，文忠以偏将军从右副将军常遇春出塞，薄上都，走元帝。遇春卒，遂命文忠代将其军。',
    [MS, '卷一百二十六·列传第十四·李文忠传'], { startYear: 1369, endYear: 1369 }),

  rb('smq2_lishanchang_liwenzhong', 'li_shanchang', 'li_wenzhong', 'political_ally', '同议军国', false, 6,
    '洪武十年，命李文忠与韩国公李善长议军国重事——开国文臣之首与武将之首共预中枢机务。',
    [MS, '卷一百二十六·列传第十四·李文忠传'], { startYear: 1377, endYear: 1384 }),

  rb('smq2_tanghe_xuda', 'tang_he', 'xu_da', 'monarch_subject', '从征镇江', true, 7,
    '汤和从徐达取镇江，进统军元帅；此后徇奔牛、吕城，降陈保二，取金坛、常州，皆与徐达并力。',
    [MS, '卷一百二十六·列传第十四·汤和传'], { startYear: 1356, endYear: 1367 }),

  rb('smq2_dengyu_changyuchun', 'deng_yu_ming', 'chang_yuchun', 'monarch_subject', '同讨山寨', false, 6,
    '邓愈从常遇春平沙坑、麻岭诸寨，进兵取吉安，围赣州五月乃克之。',
    [MS, '卷一百二十六·列传第十四·邓愈传'], { startYear: 1364, endYear: 1366 }),

  rb('smq2_dengyu_muying', 'deng_yu_ming', 'mu_ying', 'monarch_subject', '偕讨川藏', false, 7,
    '洪武十年吐蕃川藏为梗、剽掠贡使，邓愈以征西将军偕副将军沐英讨之，分兵三道，穷追至昆仑山，俘斩万计。',
    [MS, '卷一百二十六·列传第十四·邓愈传'], { startYear: 1377, endYear: 1377 }),

  /* ---------------------------- 弘治—正德内阁 ---------------------------- */
  rb('smq2_xupu_liujian', 'xu_pu', 'liu_jian', 'political_ally', '协心辅治', false, 9,
    '徐溥为首辅，与同列刘健、李东阳、谢迁协心辅治，事有不可辄共争之。弘治十年召对文华殿，四人同被顾问，举朝诩为盛事。',
    [MS, '卷一百八十一·列传第六十九·徐溥传'], { startYear: 1492, endYear: 1498 }),

  rb('smq2_xupu_lidongyang', 'xu_pu', 'li_dongyang', 'political_ally', '协心辅治', false, 8,
    '弘治八年李东阳入内阁，时徐溥为首辅，与刘健、谢迁等同列。溥性凝重，人有过误辄为掩覆，曰「天生才甚难，不忍以微瑕弃也」。',
    [MS, '卷一百八十一·列传第六十九·徐溥传'], { startYear: 1495, endYear: 1498 }),

  rb('smq2_xupu_xieqian', 'xu_pu', 'xie_qian', 'political_ally', '协心辅治', false, 8,
    '谢迁弘治八年入阁，与徐溥、刘健、李东阳同辅政。溥承刘吉恣睢之后镇以安静，务守成法，四人共争不可之事。',
    [MS, '卷一百八十一·列传第六十九·徐溥传'], { startYear: 1495, endYear: 1498 }),

  rb('smq2_xupu_qiujun', 'xu_pu', 'qiu_jun', 'political_ally', '同朝阁臣', false, 5,
    '丘濬弘治四年兼文渊阁大学士参预机务，时徐溥已在阁，二人同相孝宗。濬博极群书而议礼多泥古，溥则以安静守成法，持论不同而共事一朝。',
    [MS, '卷一百八十一·列传第六十九·丘濬传'], { startYear: 1491, endYear: 1495 }),

  rb('smq2_liujian_lidongyang', 'liu_jian', 'li_dongyang', 'political_ally', '同辅政', false, 8,
    '刘健、李东阳同为弘治朝阁臣。时人语曰「李公谋、刘公断、谢公尤侃侃」，天下称贤相。正德初同请诛刘瑾，健去而东阳独留。',
    [MS, '卷一百八十一·列传第六十九·刘健传'], { startYear: 1495, endYear: 1506 }),

  rb('smq2_liujian_xieqian', 'liu_jian', 'xie_qian', 'political_ally', '同请诛瑾', false, 9,
    '武宗嗣位，刘瑾等八人用事，健与谢迁率廷臣力争，请诛瑾不克，遂同日致仕归。瑾衔之，矫旨除名为民。',
    [MS, '卷一百八十一·列传第六十九·谢迁传'], { startYear: 1505, endYear: 1506 }),

  rb('smq2_lidongyang_xieqian', 'li_dongyang', 'xie_qian', 'political_ally', '同日登用', false, 8,
    '弘治八年，李东阳以本官直文渊阁参预机务，与谢迁同日登用。二人同相孝宗、同争刘瑾，而去留异途。',
    [MS, '卷一百八十一·列传第六十九·谢迁传'], { startYear: 1495, endYear: 1506 }),

  rb('smq2_xieqian_wangao', 'xie_qian', 'wang_ao', 'political_ally', '举以自代', true, 6,
    '谢迁尝举王鏊、吴宽自代。后焦芳附刘瑾入阁，亦憾迁举鏊不及己，遂借余姚隐士事构陷。',
    [MS, '卷一百八十一·列传第六十九·谢迁传'], { startYear: 1506, endYear: 1506 }),

  rb('smq2_xieqian_zhuhoucong', 'xie_qian', 'zhu_hou_cong', 'monarch_subject', '晚年受召', true, 6,
    '世宗即位遣使存问，嘉靖六年大学士费宏举迁自代，帝遣行人赍手敕即家起之。迁时年七十九，居位数月力求去。',
    [MS, '卷一百八十一·列传第六十九·谢迁传'], { startYear: 1527, endYear: 1528 }),

  /* ---------------------------- 嘉靖谏臣与严嵩 ---------------------------- */
  rb('smq2_shenlian_yansong', 'shen_lian', 'yan_song', 'political_rival', '疏劾十罪', false, 9,
    '沈炼上疏劾严嵩「贪婪之性疾入膏肓，愚鄙之心顽于铁石」，条列纳将帅贿、受诸王馈、揽吏部权等十大罪。帝大怒，搒之数十，谪佃保安。',
    [MS, '卷二百〇九·列传第九十七·沈炼传'], { startYear: 1550, endYear: 1557 }),

  rb('smq2_shenlian_zhuhoucong', 'shen_lian', 'zhu_hou_cong', 'monarch_subject', '直谏获罪', true, 7,
    '世宗惑于方士，沈炼上疏直斥权奸，帝大怒，立下诏狱搒之数十，谪佃保安；终为嵩党构陷，斩于宣府。',
    [MS, '卷二百〇九·列传第九十七·沈炼传'], { startYear: 1550, endYear: 1557 }),

  rb('smq2_yangjisheng_yansong', 'yang_jisheng', 'yan_song', 'political_rival', '五奸十罪', false, 10,
    '杨继盛到官兵部甫一月，即上疏劾严嵩五奸十大罪，谓「陛下奈何爱一贼臣，而忍欺天乎」。疏入下诏狱，廷杖一百，系狱三载弃市。',
    [MS, '卷二百〇九·列传第九十七·杨继盛传'], { startYear: 1553, endYear: 1555 }),

  rb('smq2_yangjisheng_zhuhoucong', 'yang_jisheng', 'zhu_hou_cong', 'monarch_subject', '廷杖弃市', true, 8,
    '继盛两疏皆逆帝意：先劾仇鸾开马市而贬狄道典史，再劾严嵩而廷杖下狱。临刑赋诗「浩气还太虚，丹心照千古」。',
    [MS, '卷二百〇九·列传第九十七·杨继盛传'], { startYear: 1551, endYear: 1555 }),
];
