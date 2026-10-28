/**
 * 新莽·更始 · 补述层关系边（edges-brief-e）
 * ------------------------------------------------------------------
 * 与 `persons-brief-e.ts` 配套。原则同全站：**新增的每个人至少连一条边**，
 * 孤立节点等于不存在——补了人却补不出关系，图上只是一堆散点。
 *
 * 三条合并过的「同对一论」：
 *  - 朱鲔—李轶：先是共屯洛阳的同党，后是刺杀之仇。一条边写足两段，
 *    不拆成 ally + rival 两条——同一对人两条边会让力导向把两点拉得忽近忽远。
 *  - 王遵—隗嚣：明威将军是本号，归汉是结局。用 monarch_subject 而
 *    summary 里写明「后归汉」，不另立一条 rival。
 *  - 谢禄—刘玄：受降者与被杀者。用 military_adversary 而非 monarch_subject，
 *    因为这条边要记的事是缢杀，不是君臣名分——更始从未臣于赤眉。
 *
 * 边一律 `directed: true`：本片是「谁隶属谁、谁杀谁」，方向有意义。
 */
import { rb } from '../_helpers';
import type { HistoricalRelationEdge } from '@/types/history';

const HHS = '《后汉书》';

const V11 = '卷十一·刘玄刘盆子列传第一';
const V12 = '卷十二·王刘张李彭卢列传第二';
const V13 = '卷十三·隗嚣公孙述列传第三';
const V18 = '卷十八·吴盖陈臧列传第八';
const V19 = '卷十九·耿弇列传第九';
const V20 = '卷二十·铫期王霸祭遵列传第十';
const V21 = '卷二十一·任李万邳刘耿列传第十一';
const V22 = '卷二十二·朱景王杜马刘傅坚马列传第十二';

export const xinMangBriefEdgesE: HistoricalRelationEdge[] = [
  /* ====================== 云台诸将 ====================== */
  rb('xm_e_ba_xiu', 'wang_ba', 'liu_xiu', 'monarch_subject', '君臣', true, 8,
    '王霸为光武元从，从平河北，后拜上谷太守守边二十余年，为云台二十八将之一。',
    [HHS, V20], { startYear: 23, endYear: 59 }),
  rb('xm_e_zun_xiu', 'zhai_zun', 'liu_xiu', 'monarch_subject', '君臣·克己奉公', true, 8,
    '祭遵为光武军中执法最严者。卒后光武每叹「安得忧国奉公之臣如祭征虏者乎」，其见重如此。',
    [HHS, V20], { startYear: 24, endYear: 33 }),
  rb('xm_e_ba_zun', 'wang_ba', 'zhai_zun', 'political_ally', '同郡同传', true, 5,
    '王霸、祭遵同为颍川颍阳人，同从光武于河北，又同在一卷立传，是光武元从中的同乡一系。',
    [HHS, V20], { startYear: 23, endYear: 33 }),
  rb('xm_e_chun_xiu', 'geng_chun', 'liu_xiu', 'monarch_subject', '君臣·焚庐舍劝进', true, 8,
    '耿纯率宗族宾客二千余人归光武，恐宗人怀归，焚其庐舍以绝反顾之望；又首倡上尊号，光武即位于鄗。',
    [HHS, V21], { startYear: 24, endYear: 37 }),
  rb('xm_e_you_xiu', 'zhu_you', 'liu_xiu', 'political_ally', '少相亲爱', true, 7,
    '朱祐与光武微时相亲爱，光武尝往其家；起兵后为建义大将军，封鬲侯。',
    [HHS, V22], { startYear: 22, endYear: 48 }),
  rb('xm_e_dan_xiu', 'jing_dan', 'liu_xiu', 'monarch_subject', '突骑南下', true, 7,
    '景丹与耿况、寇恂等发上谷突骑南下助光武，破王郎诸将，拜骠骑大将军。',
    [HHS, V22], { startYear: 24, endYear: 26 }),
  rb('xm_e_dan_yan', 'jing_dan', 'geng_yan', 'political_ally', '同上谷兵南下', true, 6,
    '二人同以渔阳、上谷突骑归光武：耿弇为其父上谷太守耿况之子，景丹为上谷郡吏，同途南下。',
    [HHS, V22], { startYear: 24, endYear: 26 }),
  rb('xm_e_liang_xiu', 'wang_liang', 'liu_xiu', 'monarch_subject', '以谶拜大司空', true, 7,
    '光武即位议选大司空，因《赤伏符》有「王梁主卫作玄武」之文，自野王令超拜王梁为大司空——东汉初以图谶用人，此为最著一例。',
    [HHS, V22], { startYear: 25, endYear: 38 }),
  rb('xm_e_yan_xiu', 'gai_yan', 'liu_xiu', 'monarch_subject', '君臣·虎牙大将军', true, 7,
    '盖延身长八尺、弯弓三百斤，为光武虎牙大将军，与吴汉共平东方刘永、董宪、庞萌。',
    [HHS, V18], { startYear: 24, endYear: 39 }),
  rb('xm_e_gong_xiu', 'zang_gong', 'liu_xiu', 'monarch_subject', '君臣·辅威将军', true, 7,
    '臧宫为辅威将军，从吴汉伐蜀，破延岑、受王元之降，蜀平封朗陵侯。',
    [HHS, V18], { startYear: 24, endYear: 58 }),
  rb('xm_e_yan_meng', 'gai_yan', 'pang_meng', 'military_adversary', '东平之役', true, 6,
    '庞萌反，袭破盖延军，与董宪连和。盖延讨之不利，光武乃自将亲征，历岁乃平。',
    [HHS, V12], { startYear: 29, endYear: 30 }),
  rb('xm_e_gong_cen', 'zang_gong', 'yan_cen', 'military_adversary', '破延岑于蜀', true, 6,
    '建武十二年臧宫与吴汉分道入蜀，破蜀大司马延岑，成都遂下。',
    [HHS, V13], { startYear: 36, endYear: 36 }),
  rb('xm_e_gong_yuan', 'zang_gong', 'wang_yuan', 'monarch_subject', '兵败归降', true, 5,
    '王元留为蜀将，及臧宫破延岑，乃举众诣臧宫降，拜上蔡令。',
    [HHS, V13], { startYear: 36, endYear: 36 }),

  /* ====================== 陇右隗嚣 ====================== */
  rb('xm_e_cui_xiao', 'wei_cui', 'wei_xiao', 'kinship_blood', '季父', true, 8,
    '隗崔为隗嚣季父，素豪侠能得众。起兵攻平襄后，与杨广等共推隗嚣为上将军，自为白虎将军。',
    [HHS, V13], { startYear: 23, endYear: 24 }),
  rb('xm_e_yuan_xiao', 'wang_yuan', 'wei_xiao', 'monarch_subject', '大将军·丸泥封关', true, 9,
    '王元为隗嚣大将军，说以「元请以一丸泥为大王东封函谷关」，隗嚣心然其计，遂负险不归汉。',
    [HHS, V13], { startYear: 29, endYear: 33 }),
  rb('xm_e_guang_xiao', 'yang_guang_ly', 'wei_xiao', 'monarch_subject', '右将军', true, 7,
    '杨广为隗嚣右将军，起兵时即与其谋。隗嚣败后奔西城依之，杨广死而隗嚣势穷。',
    [HHS, V13], { startYear: 23, endYear: 33 }),
  rb('xm_e_zun_xiao', 'wang_zun', 'wei_xiao', 'monarch_subject', '明威将军，后归汉', true, 7,
    '王遵为隗嚣明威将军，数谏遣子入侍而不见听，遂与家属东诣京师，拜太中大夫，封向义侯。',
    [HHS, V13], { startYear: 23, endYear: 31 }),
  rb('xm_e_zun_niu', 'wang_zun', 'niu_han', 'political_ally', '以书招降', true, 7,
    '王遵知隗嚣必败，而与牛邯有旧，乃以书喻之。牛邯沉吟十余日，谢士众归洛阳。',
    [HHS, V13], { startYear: 32, endYear: 32 }),
  rb('xm_e_niu_xiao', 'niu_han', 'wei_xiao', 'monarch_subject', '守瓦亭', true, 6,
    '牛邯有勇力才气、雄于边垂，隗嚣使守瓦亭以拒汉军；降汉后隗嚣大将十三人、属县十六相继瓦解。',
    [HHS, V13], { startYear: 32, endYear: 32 }),
  rb('xm_e_lin_xiao', 'du_lin', 'wei_xiao', 'monarch_subject', '为隗嚣治书', true, 6,
    '杜林避乱客河西，隗嚣深敬其学，以为治书（掌文书）。杜林在其帐下而不为所屈，后归汉为大司空。',
    [HHS, V13], { startYear: 26, endYear: 32 }),
  rb('xm_e_lin_niu', 'du_lin', 'niu_han', 'political_ally', '与马援并荐', true, 5,
    '牛邯降后，大司徒司直杜林与太中大夫马援并荐之，以为护羌校尉，与来歙共平陇右。',
    [HHS, V13], { startYear: 32, endYear: 33 }),

  /* ====================== 巴蜀成家 ====================== */
  rb('xm_e_xiong_shu', 'li_xiong', 'gongsun_shu', 'monarch_subject', '功曹劝进', true, 7,
    '李熊为公孙述功曹，先劝其称蜀王，再劝其称天子，成家之号实由此出。',
    [HHS, V13], { startYear: 25, endYear: 25 }),
  rb('xm_e_han_shu', 'jing_han', 'gongsun_shu', 'monarch_subject', '骑都尉上疏', true, 7,
    '荆邯为公孙述骑都尉，建武七年上疏请乘东方未定发兵争天下，述是其言而终为群议所阻。',
    [HHS, V13], { startYear: 31, endYear: 31 }),
  rb('xm_e_cen_shu', 'yan_cen', 'gongsun_shu', 'monarch_subject', '大司马·汝宁王', true, 7,
    '延岑自汉中转战三辅、南阳，兵败后奔蜀，公孙述以为大司马，封汝宁王，是成家最后一位硬将。',
    [HHS, V13], { startYear: 29, endYear: 36 }),
  rb('xm_e_rong_shu', 'tian_rong', 'gongsun_shu', 'monarch_subject', '翼江王', true, 6,
    '田戎据夷陵，秦丰亡后奔蜀，公孙述以为翼江王，使与任满等据荆门，扼三峡之口。',
    [HHS, V13], { startYear: 29, endYear: 35 }),
  rb('xm_e_han_cen', 'jing_han', 'yan_cen', 'political_ally', '献策使出汉中', true, 5,
    '荆邯之策以「令延岑出汉中，定三辅」为西路，延岑亦屡请兵立功，而公孙述终疑不听。',
    [HHS, V13], { startYear: 31, endYear: 31 }),
  rb('xm_e_han_rong', 'jing_han', 'tian_rong', 'political_ally', '献策使据江陵', true, 5,
    '荆邯之策以「令田戎据江陵，临江南之会」为东路，欲传檄吴楚。',
    [HHS, V13], { startYear: 31, endYear: 31 }),
  rb('xm_e_cen_rong', 'yan_cen', 'tian_rong', 'political_ally', '同奔于蜀', true, 6,
    '秦丰败亡后，延岑与田戎同奔蜀，并为公孙述所倚；二人又同请兵立功而终不见听。',
    [HHS, V13], { startYear: 29, endYear: 36 }),

  /* ====================== 河西窦融 ====================== */
  rb('xm_e_tong_rong', 'liang_tong', 'dou_rong', 'political_ally', '共保河西', true, 8,
    '梁统与窦融等共推融行河西五郡大将军事，保境自守；建武五年又随融入朝，封成义侯。',
    [HHS, '卷三十四·梁统列传第二十四'], { startYear: 25, endYear: 29 }),
  rb('xm_e_fen_rong', 'kong_fen', 'dou_rong', 'monarch_subject', '姑臧长属河西', true, 5,
    '孔奋为姑臧长，在窦融所统河西五郡之内，以清节自守见称于时。',
    [HHS, '卷三十一·郭杜孔张廉王苏羊贾陆列传第二十一'], { startYear: 30, endYear: 36 }),

  /* ====================== 梁地刘永 ====================== */
  rb('xm_e_meng_yong', 'pang_meng', 'liu_yong_xm', 'monarch_subject', '受封东平王', true, 6,
    '庞萌反后与董宪连和，梁王刘永立之为东平王，与张步、董宪并为东方三藩。',
    [HHS, V12], { startYear: 29, endYear: 30 }),

  /* ====================== 齐地张步 ====================== */
  rb('xm_e_fei_bu', 'fei_yi_xm', 'zhang_bu', 'monarch_subject', '大将军', true, 6,
    '费邑为张步大将军，屯历下以备汉军，分遣其弟费敢守巨里。',
    [HHS, V19], { startYear: 29, endYear: 29 }),
  rb('xm_e_lan_bu', 'zhang_lan', 'zhang_bu', 'kinship_blood', '兄弟', true, 7,
    '张蓝为张步之弟，张步使之将精兵二万守西安，为都城剧县屏障。',
    [HHS, V19], { startYear: 29, endYear: 29 }),
  rb('xm_e_fei_yan', 'fei_yi_xm', 'geng_yan', 'military_adversary', '临阵被斩', true, 7,
    '耿弇扬言攻巨里，诱费邑自将精兵三万来救，乘高合战，临阵斩之，济南四十余营遂下。',
    [HHS, V19], { startYear: 29, endYear: 29 }),
  rb('xm_e_lan_yan', 'zhang_lan', 'geng_yan', 'military_adversary', '西安之守', true, 6,
    '耿弇舍坚攻瑕，扬言五日攻西安而夜趋临淄，半日拔之；张蓝闻临淄破，弃西安亡归剧。',
    [HHS, V19], { startYear: 29, endYear: 29 }),

  /* ====================== 渔阳彭宠 ====================== */
  rb('xm_e_mi_chong', 'zi_mi', 'peng_chong', 'monarch_subject', '苍头弑主', true, 7,
    '子密为彭宠苍头。建武五年与二奴夜斩彭宠及其妻，持首级奔洛阳，光武封为不义侯——封其功而斥其义。',
    [HHS, V12], { startYear: 29, endYear: 29 }),

  /* ====================== 更始政权 ====================== */
  rb('xm_e_wei_xuan', 'zhu_wei', 'liu_xuan', 'monarch_subject', '大司马', true, 8,
    '朱鲔为更始大司马，封胶东王而固辞，转左大司马，是更始政权掌兵最重的一人。',
    [HHS, V11], { startYear: 23, endYear: 25 }),
  rb('xm_e_wei_yi', 'zhu_wei', 'li_yi', 'political_ally', '共屯洛阳而终相图', true, 8,
    '二人先共谋杀刘縯、同拥兵三十万屯洛阳，后又因李轶通款于冯异，朱鲔怒而刺杀之——同党终成仇雠。',
    [HHS, V11], { startYear: 23, endYear: 25 }),
  rb('xm_e_wei_yan', 'zhu_wei', 'liu_yan_xm', 'political_rival', '共谋诛之', true, 7,
    '刘縯威望日盛，更始诸将忌之，朱鲔与李轶共献计，诛刘縯及其部将刘稷。',
    [HHS, V11], { startYear: 23, endYear: 23 }),
  rb('xm_e_wei_xiu', 'zhu_wei', 'liu_xiu', 'monarch_subject', '洛阳守将，后归汉', true, 8,
    '朱鲔坚守洛阳数月不下。岑彭往说，朱鲔以曾谋害刘縯自陈不敢降，光武指河为誓「河水在此，吾不食言」，乃面缚出降。',
    [HHS, V11], { startYear: 25, endYear: 25 }),
  rb('xm_e_yi_yan', 'li_yi', 'liu_yan_xm', 'political_rival', '谄事新贵而谋之', true, 7,
    '李轶本与刘縯兄弟同谋起兵，后转而谄事更始诸将，与朱鲔共谋杀刘縯，光武由是深疑之。',
    [HHS, V11], { startYear: 23, endYear: 23 }),
  rb('xm_e_yi_tong', 'li_yi', 'li_tong', 'kinship_blood', '从兄弟', true, 6,
    '李轶为李通从弟，同预宛城起兵之谋。',
    [HHS, V11], { startYear: 22, endYear: 25 }),
  rb('xm_e_yi_xiu', 'li_yi', 'liu_xiu', 'political_rival', '反间见杀', true, 7,
    '李轶复书通款于冯异，冯异故泄其书于朱鲔，朱鲔大怒刺杀之，其部众遂降汉——此为光武最省力的一次反间。',
    [HHS, V11], { startYear: 25, endYear: 25 }),

  /* ====================== 赤眉 ====================== */
  rb('xm_e_lu_xuan', 'xie_lu', 'liu_xuan', 'military_adversary', '受降而缢杀之', true, 6,
    '谢禄受更始之降，刘玄降后常依之而居；后三辅欲盗出更始，张卬等虑变，使谢禄缢杀之。',
    [HHS, V11], { startYear: 25, endYear: 25 }),
  rb('xm_e_lu_chong', 'xie_lu', 'fan_chong', 'monarch_subject', '赤眉将', true, 5,
    '谢禄为樊崇所统赤眉诸将之一，入长安后受更始之降。',
    [HHS, V11], { startYear: 25, endYear: 27 }),

  /* ====================== 隐逸 ====================== */
  rb('xm_e_meng_guang', 'feng_meng', 'yan_guang', 'literary_bosom', '同为逸民，同传', true, 5,
    '逢萌与严光同居《后汉书·逸民列传》，皆王莽之乱避世、光武征之不起者，是本片「隐逸」一系的两端。',
    [HHS, '卷八十三·逸民列传第七十三'], { startYear: 3, endYear: 57 }),
  rb('xm_e_hong_meng', 'liang_hong', 'feng_meng', 'literary_bosom', '同传逸民', true, 4,
    '梁鸿与逢萌同传。梁鸿以《五噫之歌》见忌于朝，逢萌以挂冠东都门避祸，同为东汉初不仕之标。',
    [HHS, '卷八十三·逸民列传第七十三'], { startYear: 25, endYear: 80 }),

  /* ====================== 经生 ====================== */
  rb('xm_e_chong_biao', 'wang_chong', 'ban_biao', 'mentor_disciple', '师事班彪', true, 6,
    '王充至洛阳受业太学，师事扶风班彪；后著《论衡》，其「疾虚妄」之旨与班彪《王命论》同出两汉之际的实证一路。',
    [HHS, '卷四十九·王充王符仲长统列传第三十九'], { startYear: 45, endYear: 54 }),
  rb('xm_e_lin_xiu', 'du_lin', 'liu_xiu', 'monarch_subject', '君臣·大司空', true, 6,
    '杜林归汉后历侍御史、大司徒司直、少府，终拜大司空，为光武朝「通儒」之望。',
    [HHS, '卷二十七·宣张二王杜郭吴承郑赵列传第十七'], { startYear: 32, endYear: 47 }),

  /* ====================== 反莽起兵：刘信、刘璜 ====================== */
  rb('xm_e_xin_yi', 'liu_xin_yx', 'zhai_yi', 'political_ally', '结谋举兵，立为天子', true, 9,
    '翟义与东郡都尉刘宇、严乡侯刘信、信弟武平侯刘璜结谋，以九月都试日举兵，立刘信为天子，翟义自号大司马、柱天大将军，移檄郡国。',
    ['《汉书》', '卷八十四·翟方进传第五十四'], { startYear: 7, endYear: 7 }),
  rb('xm_e_huang_xin', 'liu_huang', 'liu_xin_yx', 'kinship_blood', '兄弟', true, 7,
    '刘璜为严乡侯刘信之弟，同出东平王一系，同居翟义举兵之谋。',
    ['《汉书》', '卷八十四·翟方进传第五十四'], { startYear: 7, endYear: 7 }),

  /* ====================== 并州卢芳：卢程、随昱、贾览 ====================== */
  rb('xm_e_cheng_fang', 'lu_cheng', 'lu_fang', 'kinship_blood', '兄弟', true, 7,
    '卢程为卢芳之弟。单于立卢芳为汉帝后，以卢程为中郎将，将胡骑还入安定——卢芳之号在汉，其兵在胡，此一层最见其傀儡之实。',
    [HHS, V12], { startYear: 25, endYear: 25 }),
  rb('xm_e_yu_fang', 'sui_yu', 'lu_fang', 'monarch_subject', '九原守将，后胁芳降汉', true, 8,
    '随昱本五原豪杰，建武五年迎卢芳入塞、都九原；建武十二年留守九原而欲胁芳降，卢芳弃辎重亡入匈奴，其众尽归随昱。',
    [HHS, V12], { startYear: 29, endYear: 36 }),
  rb('xm_e_lan_fang', 'jia_lan', 'lu_fang', 'monarch_subject', '将军·将胡骑', true, 6,
    '贾览为卢芳将军，所将皆匈奴胡骑；建武六年击杀代郡太守刘兴，十二又与卢芳共攻云中。',
    [HHS, V12], { startYear: 30, endYear: 36 }),
  rb('xm_e_lan_yu', 'jia_lan', 'sui_yu', 'political_ally', '同据五原', true, 5,
    '二人同为卢芳所倚的边郡实力：贾览将胡骑在外，随昱守九原在内。十二年贾览随芳攻云中，随昱遂据九原降汉。',
    [HHS, V12], { startYear: 29, endYear: 36 }),
];
