/**
 * 分片 · 先秦（丁）：简目连线
 * ------------------------------------------------------------------
 * 五条纪律，逐条都是这一批真会踩到的坑：
 *
 * 一、**并称不等于交往**。苏秦与公孙衍并为从约长，而史不载二人相见；
 *     华元与向戌同为宋之执政，相隔五十年。凡此类必在 summary 里明写「不相及」，
 *     只系其事的承绪，不假造会面。
 * 二、**同国不等于同朝**。宋襄公（前 650 卒）与华元（前 595 在世）不得作君臣；
 *     魏文侯与庞涓不得作君臣。只连确有其事的那一对。
 * 三、**附见不等于本传**。伯嚭事附《吴太伯世家》与《伍子胥列传》，
 *     庞涓事附《孙子吴起列传》，著录时写明卷次，不假装有本传。
 * 四、**一人一对只留一条边**。同一对人物在不同阶段有不同性质（如夫差与勾践：
 *     夫椒之胜、会稽之许、黄池之袭、灭吴之终），一律并进同一条 summary，
 *     不拆成四条平行边——画布上会出现四根重叠的线，点选时只认最上面一根。
 * 五、**传说不上图**。西施、郑旦不见于《史记》，越灭吴后伍员显灵一类齐东野语，
 *     一概不入边、不入传。
 */
import { rb } from '../_helpers';

const SJ = '《史记》';
const ZUO = '《左传》';

export const preQinBriefEdgesC = [
  /* ------------------------------ 吴越 ------------------------------ */
  rb('pq_c_fuchai_helv', 'wu_wang_helv', 'wu_wang_fuchai', 'kinship_blood', '父子', true, 9,
    '阖闾伐越，伤于槜李，病且死，谓太子夫差曰「尔而忘句践杀汝父乎」，对曰「不敢忘」。三年而报越。',
    [SJ, '卷三十一·吴太伯世家'], { startYear: -496, endYear: -496 }),
  rb('pq_c_fuchai_goujian', 'wu_wang_fuchai', 'gou_jian', 'military_adversary', '夫椒与会稽', true, 9,
    '夫差败越于夫椒，勾践以甲兵五千栖于会稽，卑辞请为臣妾；伍员谏不可，夫差许之。二十三年后越灭吴，夫差请为附庸而不许，遂自杀。二人相为胜败者两世。',
    [SJ, '卷四十一·越王句践世家'], { startYear: -494, endYear: -473 }),
  rb('pq_c_fuchai_wuzixu', 'wu_wang_fuchai', 'wu_zixu', 'monarch_subject', '谏而不听·赐剑', true, 9,
    '夫差既许越和，伍员屡谏，至伐齐时争之尤力。夫差怒，使赐属镂之剑，伍员自刭。临死曰「抉吾眼县吴东门之上，以观越寇之入灭吴也」。',
    [SJ, '卷六十六·伍子胥列传'], { startYear: -494, endYear: -484 }),
  rb('pq_c_boqi_fuchai', 'bo_pi', 'wu_wang_fuchai', 'monarch_subject', '太宰见信', true, 8,
    '伯嚭自楚奔吴，夫差以为太宰，宠信之。吴之大事，多决于嚭。',
    [SJ, '卷三十一·吴太伯世家']),
  rb('pq_c_boqi_wuzixu', 'bo_pi', 'wu_zixu', 'political_rival', '谮而杀之', true, 8,
    '伍员力主灭越、阻伐齐，伯嚭受越之赂而主和，二人议事每相左。嚭与逢同共谮伍员，夫差遂赐之死。',
    [SJ, '卷六十六·伍子胥列传'], { startYear: -494, endYear: -484 }),
  rb('pq_c_boqi_wenzhong', 'bo_pi', 'wen_zhong', 'political_ally', '受赂主和', true, 6,
    '越败于夫椒，文种奉美女宝器遗吴太宰嚭，嚭受之，力劝夫差许越和。此边所系者赂，非交谊。',
    [SJ, '卷四十一·越王句践世家'], { startYear: -494, endYear: -494 }),

  /* ------------------------------- 宋 ------------------------------- */
  rb('pq_c_huayuan_xionglv', 'hua_yuan', 'chu_zhuang_wang', 'military_adversary', '楚围宋·夜登子反床', true, 8,
    '楚庄王围宋五月不解，城中易子而食、析骸以爨。华元夜入楚师，登子反之床而起之，具告以情，子反惧而与盟，楚师退三十里。',
    [SJ, '卷四十·楚世家'], { startYear: -595, endYear: -595 }),
  rb('pq_c_xiangxu_huayuan', 'xiang_xu', 'hua_yuan', 'political_ally', '同为宋之执政', false, 5,
    '二人先后执宋国之政，华元主前 579 年之弭兵，向戌主前 546 年之弭兵。**二人相隔五十余年，终身未尝相见**，此边只系宋国执政之传绪，不作交游看。',
    [SJ, '卷三十八·宋微子世家']),

  /* ------------------------------- 鲁 ------------------------------- */
  rb('pq_c_zhuanggong_qingfu', 'lu_zhuang_gong', 'qing_fu', 'kinship_blood', '兄弟', false, 8,
    '庆父为庄公庶兄，其后为仲孙氏。庄公疾，问后于叔牙，叔牙曰「庆父材」，遂启季友酖叔牙之事。',
    [SJ, '卷三十三·鲁周公世家']),
  rb('pq_c_zhuanggong_jiyou', 'lu_zhuang_gong', 'ji_you', 'kinship_blood', '兄弟', false, 8,
    '季友为庄公少子之弟，庄公疾而托后，季友乃酖叔牙、立子般。',
    [SJ, '卷三十三·鲁周公世家']),
  rb('pq_c_zhuanggong_caogui', 'lu_zhuang_gong', 'cao_gui', 'monarch_subject', '长勺请见', true, 8,
    '齐师伐鲁，庄公将战，曹刿请见，问「何以战」。公以「小大之狱，虽不能察，必以情」对，刿曰「忠之属也，可以一战」。',
    [ZUO, '庄公十年'], { startYear: -684, endYear: -684 }),
  rb('pq_c_zhuanggong_qihuan', 'lu_zhuang_gong', 'qi_huan_gong', 'military_adversary', '长勺败齐·柯盟反地', true, 8,
    '齐桓公伐鲁，庄公败之于长勺；后桓公复与鲁会于柯，曹沬劫盟，尽反鲁之侵地。鲁之得全，实赖此二役。',
    [SJ, '卷三十二·齐太公世家'], { startYear: -684, endYear: -681 }),
  rb('pq_c_caogui_qihuan', 'cao_gui', 'qi_huan_gong', 'political_rival', '柯之盟劫桓公', true, 8,
    '《史记》作曹沬。齐桓公与鲁庄公会于柯，曹沬以匕首劫桓公于坛上，曰「反鲁之侵地」，桓公许之；既而欲倍约，管仲谏乃止。',
    [SJ, '卷八十六·刺客列传'], { startYear: -681, endYear: -681 }),
  rb('pq_c_caogui_guanzhong', 'cao_gui', 'guan_zhong', 'political_ally', '守柯之盟', false, 6,
    '曹刿劫盟，桓公怒而欲倍之。管仲曰「不可，夫贪小利以自快，弃信于诸侯，失天下之援，不如与之」，遂反侵地。**二人非有交谊**，此边所系者，一劫一成之间，齐之所以得信于诸侯。',
    [SJ, '卷八十六·刺客列传'], { startYear: -681, endYear: -681 }),
  rb('pq_c_qingfu_jiyou', 'qing_fu', 'ji_you', 'political_rival', '争立定乱', true, 9,
    '庄公卒，季友立子般，庆父弑之而立闵公；庆父又弑闵公而奔莒，季友以僖公入鲁，赂莒索庆父，庆父自杀。鲁难终始，皆此二人。',
    [SJ, '卷三十三·鲁周公世家'], { startYear: -662, endYear: -660 }),

  /* ------------------------------- 齐 ------------------------------- */
  rb('pq_c_tiandan_leyi', 'tian_dan_zg', 'yue_yi', 'military_adversary', '即墨相持·反间去毅', true, 9,
    '乐毅围即墨五年不拔，田单纵反间于燕，言乐毅欲王齐，燕惠王果使骑劫代之。田单因纵火牛破燕军，尽复七十余城。',
    [SJ, '卷八十二·田单列传'], { startYear: -284, endYear: -279 }),
  rb('pq_c_tiandan_minwang', 'tian_dan_zg', 'qi_minwang', 'monarch_subject', '市掾守即墨', true, 7,
    '田单为临淄市掾，不为人知。湣王出奔、齐城尽下，田单独以即墨拒燕，卒复齐国而迎襄王。其守即墨，正在湣王之世。',
    [SJ, '卷八十二·田单列传'], { startYear: -284, endYear: -284 }),
  rb('pq_c_minwang_leyi', 'qi_minwang', 'yue_yi', 'military_adversary', '济西之败', true, 9,
    '燕昭王与乐毅谋伐齐，合燕、秦、楚、三晋之兵。战于济西，齐师大败；乐毅遂入临淄，尽取齐之宝藏器皿。',
    [SJ, '卷八十·乐毅列传'], { startYear: -284, endYear: -284 }),
  rb('pq_c_minwang_tianwen', 'qi_minwang', 'mengchang_jun', 'political_rival', '疑而去之', true, 7,
    '湣王灭宋而益骄，欲去孟尝君。孟尝君恐，乃如魏，魏昭王以为相，西合于秦、赵，与燕共伐破齐。湣王之亡，田文与有力焉。',
    [SJ, '卷七十五·孟尝君列传'], { startYear: -286, endYear: -284 }),

  /* ------------------------------- 魏 ------------------------------- */
  rb('pq_c_pangjuan_sunbin', 'pang_juan', 'sun_bin', 'political_rival', '膑足黥面·马陵自刭', true, 9,
    '二人俱学兵法。庞涓自以为能不及孙膑，阴召至魏，以法断其两足而黥之。后孙膑为齐师，马陵之役伏弩俱发，庞涓自刭曰「遂成竖子之名」。',
    [SJ, '卷六十五·孙子吴起列传'], { startYear: -354, endYear: -341 }),
  rb('pq_c_pangjuan_tianji', 'pang_juan', 'tian_ji', 'military_adversary', '桂陵马陵', true, 8,
    '魏伐赵、伐韩，田忌皆为将而救之，孙膑为师。桂陵大破魏军，马陵再破之，庞涓死。',
    [SJ, '卷六十五·孙子吴起列传'], { startYear: -353, endYear: -341 }),

  /* ------------------------------- 楚 ------------------------------- */
  rb('pq_c_huaiwang_weiwang', 'chu_weiwang', 'chu_huaiwang', 'kinship_blood', '父子', true, 9,
    '楚威王熊商卒，子熊槐立，是为怀王。怀王承威王之余烈，地方五千里、带甲百万。',
    [SJ, '卷四十·楚世家'], { startYear: -329, endYear: -329 }),
  rb('pq_c_huaiwang_zhangyi', 'chu_huaiwang', 'zhang_yi_qin', 'political_rival', '商於六百里之欺', true, 9,
    '秦使张仪说楚，许以商於之地六百里，要楚闭关绝齐。怀王贪而信之，使勇士北骂齐王；齐楚交绝，张仪乃曰「仪与王约六里，不闻六百里」。怀王怒而攻秦，败于丹阳、蓝田，汉中入秦。',
    [SJ, '卷七十·张仪列传'], { startYear: -313, endYear: -312 }),
  rb('pq_c_huaiwang_quyuan', 'chu_huaiwang', 'qu_yuan', 'monarch_subject', '信而见疏', true, 8,
    '屈原为楚怀王左徒，入则与王图议国事，出则接遇宾客。上官大夫谗之，王怒而疏屈原。怀王入秦不返，屈原作《离骚》，终沉汨罗。',
    [SJ, '卷八十四·屈原贾生列传'], { startYear: -317, endYear: -296 }),
  rb('pq_c_baoxu_wuzixu', 'shen_baoxu', 'wu_zixu', 'political_rival', '覆楚与存楚', false, 8,
    '二人友善。伍员出亡，谓申包胥曰「我必覆楚」，申包胥曰「子能覆之，我必能兴之」。后吴入郢，申包胥哭秦庭七日而秦出师，吴师退。**终身相善而所守相左**，非仇雠之比。',
    [SJ, '卷六十六·伍子胥列传'], { startYear: -522, endYear: -505 }),

  /* ------------------------------- 秦 ------------------------------- */
  rb('pq_c_bazi_huiwen', 'qin_huiwen', 'mi_bazi', 'kinship_marriage', '妃嫔', false, 7,
    '芈八子为秦惠文王妃，号八子，生子嬴稷。',
    [SJ, '卷七十二·穰侯列传'], { startYear: -330, endYear: -311 }),
  rb('pq_c_bazi_jixia', 'mi_bazi', 'qin_zhaoxiang', 'kinship_blood', '母子', true, 9,
    '秦武王举鼎绝膑而死，无子。芈八子与异父弟魏冉迎嬴稷于燕而立之，是为昭襄王。昭王年少，宣太后自治事。',
    [SJ, '卷七十二·穰侯列传'], { startYear: -307, endYear: -307 }),
  rb('pq_c_bazi_weiran', 'mi_bazi', 'wei_ran', 'kinship_blood', '异父姐弟', false, 8,
    '宣太后二弟：异父长弟曰穰侯，姓魏氏名冉；同父弟曰芈戎。魏冉为将军，卫咸阳，威震秦国。',
    [SJ, '卷七十二·穰侯列传']),
  rb('pq_c_bazi_fanju', 'mi_bazi', 'fan_ju', 'political_rival', '废太后·逐四贵', true, 8,
    '范雎说昭王曰「今闻秦独有太后、穰侯耳」，谓四贵擅权。昭王乃废太后、逐穰侯，宣太后自是退居。',
    [SJ, '卷七十九·范雎蔡泽列传'], { startYear: -266, endYear: -266 }),

  /* ------------------------------- 晋赵 ------------------------------ */
  rb('pq_c_zhibo_xiangzi', 'zhi_bo_yao', 'zhao_xiangzi', 'political_rival', '晋阳之围·漆头为器', true, 9,
    '智伯请地于赵，赵襄子不与，遂率韩魏围晋阳三年，引晋水灌城，城不没者三版。赵襄子使张孟谈说韩魏，三家反攻灭智，赵襄子漆智伯之头以为饮器。',
    [SJ, '卷四十三·赵世家'], { startYear: -455, endYear: -453 }),
  rb('pq_c_zhaodun_zhaoshuai', 'zhao_shuai', 'zhao_dun', 'kinship_blood', '父子', true, 8,
    '赵衰从晋文公出亡，佐成霸业；其子赵盾为晋正卿，赵氏自此专晋国之政。',
    [SJ, '卷四十三·赵世家']),
  rb('pq_c_zhaodun_xiangzi', 'zhao_dun', 'zhao_xiangzi', 'kinship_blood', '赵氏世系', true, 6,
    '赵盾而下，历赵朔、赵武、赵成、赵鞅四世而至赵无恤，凡六世。赵氏自晋卿而终为诸侯，此一线不绝。',
    [SJ, '卷四十三·赵世家']),

  /* ------------------------------ 周室 ------------------------------ */
  rb('pq_c_kangwang_chengwang', 'zhou_chengwang', 'zhou_kangwang', 'kinship_blood', '父子', true, 9,
    '成王将崩，惧太子钊之不任，命召公、毕公率诸侯以相太子，作《顾命》。成王崩，钊立，是为康王。',
    [SJ, '卷四·周本纪'], { startYear: -1021, endYear: -1020 }),
  rb('pq_c_kangwang_zhaogong', 'zhou_kangwang', 'shao_gong_shi', 'monarch_subject', '顾命辅政', true, 8,
    '召公与毕公率诸侯奉太子钊见于先王庙，申告以文武之所以为王业之不易，务在节俭、毋多欲。康王即位，遍告诸侯，作《康王之诰》。',
    [SJ, '卷三十四·燕召公世家'], { startYear: -1021, endYear: -1020 }),

  /* ------------------------------ 纵横 ------------------------------ */
  rb('pq_c_gongsun_zhangyi', 'gongsun_yan', 'zhang_yi_qin', 'political_rival', '争魏相', true, 8,
    '张仪入魏为相，欲合秦魏。公孙衍患之，使人说韩公叔攻魏，魏王怒而逐张仪，以衍为相。二人相倾者累年。',
    [SJ, '卷七十·张仪列传'], { startYear: -322, endYear: -322 }),
  rb('pq_c_gongsun_suqin', 'gongsun_yan', 'su_qin', 'political_ally', '并为从约长', false, 6,
    '苏秦约从六国，佩六国相印；公孙衍尝佩五国之相印而为约长。**二人皆主合纵，而史不载其相见**，此边只系合纵之传绪，不作交游看。',
    [SJ, '卷七十·张仪列传']),
];
