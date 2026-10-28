/**
 * 分片一 · 简目连线（丁）：汉初辩士与南越世系
 * ------------------------------------------------------------------
 * 三条纪律：
 *
 *  ① **同对只留一条边**：`rb()` 不做去重，同一对人写两条会在画布上叠成一条粗线，
 *     并让「人均度数」虚高。每组关系只挑最要紧的那一条来写。
 *  ② **说得动不等于结成盟**：随何说英布归汉、侯公说项羽归太公，
 *     都是「一说而成」，事毕各自散去，不用 `political_ally` 冒充长期同盟。
 *     随何对英布用 `monarch_subject` 亦不妥——英布从未臣随何。故取 `mentor_disciple`
 *     之外最贴近的 `political_ally`，并在 `textualBasis` 里写明是「一说而降」。
 *  ③ **南越世系按《南越列传》的父子相承连**，赵佗—赵胡是祖孙而非父子，不可省一代。
 */
import { rb } from '../_helpers';

const SJ = '《史记》';
const HS = '《汉书》';

const V113 = '卷一百一十三·南越列传';
const V095 = '卷九十五·西南夷两粤朝鲜传';
const V091 = '卷九十一·黥布列传';
const V099 = '卷九十九·刘敬叔孙通列传';
const V007 = '卷七·项羽本纪';

export const chuHanBriefEdgesD = [
  /* ----------------------------- 汉初辩士 ----------------------------- */
  rb('loujing_liubang', 'liu_bang', 'lou_jing', 'monarch_subject', '脱辂献策·定都关中', true, 8,
    '娄敬以戍卒求见，力言都洛不如都关中；高祖从张良议，即日西都长安，赐姓刘氏，号奉春君。',
    [SJ, V099], { startYear: -202, endYear: -202 }),

  rb('loujing_xiongnu', 'lou_jing', 'mao_dun', 'political_ally', '和亲之策', false, 7,
    '白登围解后，娄敬建言以嫡长公主妻单于、岁奉絮缯酒食物，高祖从其策，汉匈始有和亲。',
    [SJ, V099], { startYear: -198, endYear: -198 }),

  rb('suihe_yingbu', 'sui_he', 'ying_bu', 'political_ally', '一说而降汉', true, 8,
    '随何以二十人使淮南，坐楚使上坐，宣言九江王已归汉，英布遂杀楚使而起兵背楚。',
    [SJ, V091], { startYear: -204, endYear: -204 }),

  rb('suihe_liubang', 'liu_bang', 'sui_he', 'monarch_subject', '护军中尉', true, 7,
    '随何使淮南归，自陈「二十人使淮南」之功贤于步卒五万，高祖以为护军中尉。',
    [SJ, V091], { startYear: -202, endYear: -202 }),

  rb('hougong_xiangyu', 'hou_gong', 'xiang_yu', 'political_ally', '说归太公·中分天下', true, 8,
    '侯公往说项王，项王乃与汉约中分天下，割鸿沟以西为汉、东为楚，归汉王父母妻子。',
    [SJ, V007], { startYear: -203, endYear: -203 }),

  rb('hougong_liubang', 'liu_bang', 'hou_gong', 'monarch_subject', '封平国君', true, 6,
    '汉王封侯公为平国君，曰「此天下辩士，所居倾国，故号为平国君」；侯公受封而匿，弗肯复见。',
    [SJ, V007], { startYear: -203, endYear: -203 }),

  rb('kuaitong_hanxin', 'kuai_tong', 'han_xin', 'mentor_disciple', '相背之说', true, 9,
    '蒯通以相人术说韩信，劝其据齐自立、三分天下；韩信不忍背汉，通乃佯狂为巫。',
    [SJ, '卷九十二·淮阴侯列传'], { startYear: -203, endYear: -203 }),

  rb('kuaitong_caocan', 'cao_can', 'kuai_tong', 'monarch_subject', '客于相国', true, 6,
    '曹参为齐相国，礼蒯通为上宾；通说参「请礼贤」以安齐，参从之。',
    [HS, '卷四十五·蒯伍江息夫传'], { startYear: -201, endYear: -190 }),

  /* ------------------------------- 南越 ------------------------------- */
  rb('zhaotuo_zhaohu', 'zhao_tuo', 'zhao_hu', 'kinship_blood', '祖孙相继', true, 9,
    '赵佗卒于建元四年，孙胡代立为南越王——中间不省一代，胡是佗之孙而非子。',
    [SJ, V113], { startYear: -137, endYear: -137 }),

  rb('zhaohu_zhaoyingqi', 'zhao_hu', 'zhao_yingqi', 'kinship_blood', '父子', true, 9,
    '婴齐为胡之太子，曾入宿卫长安；胡病甚，婴齐请归，胡薨而婴齐代立。',
    [SJ, V113], { startYear: -135, endYear: -122 }),

  rb('zhaoyingqi_zhaoxing', 'zhao_yingqi', 'zhao_xing', 'kinship_blood', '父子', true, 9,
    '婴齐取邯郸樛氏女而生兴，即位后上书请立樛氏为后、兴为嗣；婴齐薨，兴代立。',
    [SJ, V113], { startYear: -135, endYear: -115 }),

  rb('jiu_zhaoyingqi', 'zhao_yingqi', 'jiu_taihou', 'kinship_marriage', '邯郸樛氏女', true, 8,
    '婴齐入宿卫长安时取邯郸樛氏女，生子兴；即位后请立为后。',
    [SJ, V113], { startYear: -135, endYear: -115 }),

  rb('jiu_zhaoxing', 'jiu_taihou', 'zhao_xing', 'kinship_blood', '母子', true, 9,
    '赵兴年少嗣位，母樛太后临事，数劝王及群臣求内属；元鼎五年同被吕嘉所杀。',
    [SJ, V113], { startYear: -115, endYear: -112 }),

  rb('lvjia_zhaoxing', 'lv_jia', 'zhao_xing', 'monarch_subject', '相三王而后弑之', true, 9,
    '吕嘉相南越三王，赵兴时力拒内属；元鼎五年发兵攻王宫，杀王、太后及汉使者。',
    [SJ, V113], { startYear: -115, endYear: -112 }),

  rb('lvjia_jiu', 'lv_jia', 'jiu_taihou', 'political_rival', '置酒之变', false, 9,
    '王与太后置酒宴汉使，欲因使者之权诛吕嘉；太后当席质问，嘉觉而起出，遂称病不朝，阴与大臣作乱。',
    [SJ, V113], { startYear: -112, endYear: -112 }),

  rb('zhongjun_lvjia', 'zhong_jun', 'lv_jia', 'political_rival', '请缨使越而遇害', false, 8,
    '终军自请「愿受长缨，必羁南越王而致之阙下」，奉使宣谕内属；吕嘉反，终军死于越。',
    [HS, '卷六十四下·严朱吾丘主父徐严终王贾传'], { startYear: -113, endYear: -112 }),

  rb('zhaohu_liuche', 'liu_che', 'zhao_hu', 'monarch_subject', '藩臣请诏', true, 7,
    '闽越攻南越边邑，赵胡不敢擅兴兵，上书请天子诏；汉武帝多其义，遣两将军讨闽越。',
    [SJ, V113], { startYear: -135, endYear: -135 }),

  /* 原本还想连一条「吕嘉—路博德」的平越之役，但本片没有路博德这个节点
     （汉击南越的主将是伏波将军路博德、楼船将军杨仆，二人皆未立目）。
     为凑一条边去补立一个只因这一役才需要的人，是把边当装饰——
     故只留终军—吕嘉这一条，它已足以说明南越与汉的决裂。 */
];
