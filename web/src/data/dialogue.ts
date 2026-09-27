import type { SpeciesId } from "./content";
export type DialogueEvent = "idle" | "witness" | "death";
export const juvenileBuddingLine = "阿阿阿不要吸走生命的餡子阿阿!!";
export type AgeGroup = "adult" | "child";
type Lines = Record<DialogueEvent, string[]>;
export const commonDialogue: Record<AgeGroup, Lines> = {
  adult: {
    idle: ["油油~", "油庫里喜爹一爹捏~"],
    witness: [
      "是殺油犯阿!!",
      "為什麼永遠油庫里了阿!!",
      "快逃阿!!",
      "好臭!這個好臭!",
    ],
    death: [
      "[該油庫里的名字]什麼壞事都沒有做啊..",
      "小貝比..還在..等油回去..阿..",
      "好想..再..油庫里..",
    ],
  },
  child: {
    idle: ["油嗶~", "油庫氣喜舔一舔捏~"],
    witness: [
      "素殺油犯嘎!!",
      "為損摩永遠油庫氣惹!!",
      "塊陶阿!!",
      "豪臭!遮個豪臭!",
    ],
    death: [
      "[該油庫里的名字]明明損摩壞素都迷有做啊..",
      "把拔..馬麻..",
      "好想..再..油庫氣..",
      "糞..親油..",
    ],
  },
};
export const speciesDialogue: Record<SpeciesId, Record<AgeGroup, Lines>> = {
  reimu: {
    adult: {
      idle: [
        "油庫里之日~油庫里之天~",
        "靈夢是世界上最可愛的油庫里哦，這麼可愛真是抱歉捏！",
      ],
      witness: ["糞人類快點住手，靈夢要給你制裁哦！", "快逃啊！是殺油犯啊！"],
      death: ["為什麼要對靈夢做這種事..", "好想再..更油庫里.."],
    },
    child: {
      idle: [
        "油庫氣喜舔一舔捏！",
        "靈繆訴四界上最可愛低油庫氣，遮麼可愛真訴抱歉捏！",
      ],
      witness: ["糞忍類塊點粗手，靈繆要給你制裁哦！", "塊陶阿！素殺油犯！"],
      death: ["為損摩要欺負油..", "巴拔..馬麻..靈繆..要更.."],
    },
  },
  marisa: {
    adult: {
      idle: [
        "今天要狩獵好多好多noze！",
        "魔理沙今天也要去狩獵很多很多的好甜好甜noze！",
      ],
      witness: [
        "住手noze！你這個下種的糞人類！",
        "快逃啊！魔理沙不想永遠油庫里noze！",
      ],
      death: [
        "小貝比..還在..等魔理沙帶好甜好甜回去..noze..",
        "魔理沙..還想再..慢慢來..noze..",
      ],
    },
    child: {
      idle: ["探險隊集結noje！", "麻里恰今天要跟探險隊一起企探險noje！"],
      witness: [
        "粗手noje！你遮個下種低糞忍類！",
        "塊陶阿！麻里恰不想永遠油庫氣noje！",
      ],
      death: [
        "巴拔..馬麻..麻里恰好痛痛noje..",
        "麻里恰..還想再..油庫氣..noje..",
      ],
    },
  },
  chen: {
    adult: {
      idle: ["橙知道哦！", "那邊有很好玩的地方，橙知道哦！"],
      witness: ["為什麼要做這種事！橙不知道哦！", "快逃啊！"],
      death: ["橙..什麼都..不知道了哦..", "好痛..橙不明白哦.."],
    },
    child: {
      idle: ["橙機道哦！", "那邊有粉好玩低地方，橙機道哦！"],
      witness: ["為損摩要做遮種事！橙不機道哦！", "塊陶阿！"],
      death: ["橙..損摩都..不機道惹哦..", "好痛痛..橙不明白哦.."],
    },
  },
  alice: {
    adult: {
      idle: [
        "愛麗絲是都會派的油庫里哦！",
        "快點把好甜好甜奉獻給都會派的愛麗絲！",
      ],
      witness: [
        "咿呀啊啊！不要靠近愛麗絲，你這個垃圾人類！",
        "不要弄髒愛麗絲都會派的頭飾啊！",
      ],
      death: ["愛麗絲..明明是..都會派的..", "不要把愛麗絲當成..垃圾.."],
    },
    child: {
      idle: [
        "愛麗啾訴兜會派低油庫氣哦！",
        "塊點把搞甜搞甜奉獻給兜會派低愛麗啾哦！",
      ],
      witness: [
        "咿呀啊啊嘎！不要靠斤愛麗啾，你遮個拉機忍類！",
        "不要弄髒愛麗啾兜會派低頭飾嘎！",
      ],
      death: ["愛麗啾..明明訴..兜會派低..", "不要把愛麗啾當成..拉機.."],
    },
  },
  patchouli: {
    adult: {
      idle: ["姆Q..哪裡有魔導書姆Q..", "咳咳..有點想吐.."],
      witness: ["姆Q！不要過來姆Q！", "快點逃走姆Q！"],
      death: ["姆Q..帕秋莉..還不想..永遠油庫里姆Q..", "姆..Q.."],
    },
    child: {
      idle: ["姆Q..帕啾要安靜地油庫氣..", "咳咳..帕啾想要魔導蘇.."],
      witness: ["姆Q！不要過來！帕秋莉不好吃姆Q！", "塊點逃走姆Q！"],
      death: ["姆Q..帕啾..還不想..永遠油庫氣..", "姆..Q.."],
    },
  },
  youmu: {
    adult: {
      idle: ["咪喲今天也要努力護衛族群咪喲！", "這是咪喲的樓觀劍咪喲！"],
      witness: [
        "糞人類快住手，咪喲要用樓觀劍制裁你咪喲！",
        "危險！快點逃跑咪喲！",
      ],
      death: ["咪喲..樓觀劍..咪喲..", "咪喲..沒辦法再..護衛了..咪喲.."],
    },
    child: {
      idle: [
        "咪喲！咪喲今天也要努力保護其他夥伴咪喲！",
        "遮素咪喲低樓觀劍咪喲！",
      ],
      witness: [
        "糞忍類粗手，咪喲要用樓觀劍制裁你咪喲！",
        "咪喲嘎！危險！塊點逃跑咪喲！",
      ],
      death: [
        "咪喲低..樓觀劍..咪喲..",
        "巴拔..馬麻..咪喲沒辦法再..護衛惹..咪喲..",
      ],
    },
  },
};
export const dialogueNames: Record<SpeciesId, [string, string]> = {
  reimu: ["靈夢", "靈繆"],
  marisa: ["魔理沙", "麻里恰"],
  chen: ["橙", "橙"],
  alice: ["愛麗絲", "愛麗啾"],
  patchouli: ["帕秋莉", "帕啾"],
  youmu: ["咪喲", "咪喲"],
};
export function dialoguePool(
  species: SpeciesId,
  juvenile: boolean,
  event: DialogueEvent,
) {
  const age = juvenile ? "child" : "adult";
  return [
    ...commonDialogue[age][event],
    ...speciesDialogue[species][age][event],
  ].map((s) =>
    s.replace("[該油庫里的名字]", dialogueNames[species][juvenile ? 1 : 0]),
  );
}
