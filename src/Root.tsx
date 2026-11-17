import React from "react";
import { Composition } from "remotion";
import { PAX_FRAMES, PaxSilicaShort } from "./videos/paxsilica/PaxSilica";
import { NOTOPAX_FRAMES, NoToPaxSilicaShort } from "./videos/notopax/NoToPax";
import { RACE_FRAMES, RaceConditionShort } from "./videos/racecondition/RaceCondition";
import { IDOR_FRAMES, IdorShort } from "./videos/idor/Idor";
import { RATELIMIT_FRAMES, RateLimitShort } from "./videos/ratelimit/RateLimit";
import { SQLI_FRAMES, SqliShort } from "./videos/sqli/Sqli";
import { BINARY_FRAMES, BinaryShort } from "./videos/binary/Binary";
import { REDIS_FRAMES, RedisShort } from "./videos/redis/Redis";
import { DBINDEX_FRAMES, DbIndexShort } from "./videos/dbindex/DbIndex";

export const Root: React.FC = () => (
  <>
    <Composition id="PaxSilicaShort" component={PaxSilicaShort} durationInFrames={PAX_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="NoToPaxSilicaShort" component={NoToPaxSilicaShort} durationInFrames={NOTOPAX_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="RaceConditionShort" component={RaceConditionShort} durationInFrames={RACE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="IdorShort" component={IdorShort} durationInFrames={IDOR_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="RateLimitShort" component={RateLimitShort} durationInFrames={RATELIMIT_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="SqliShort" component={SqliShort} durationInFrames={SQLI_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="BinaryShort" component={BinaryShort} durationInFrames={BINARY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="RedisShort" component={RedisShort} durationInFrames={REDIS_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="DbIndexShort" component={DbIndexShort} durationInFrames={DBINDEX_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
