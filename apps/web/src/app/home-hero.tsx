"use client";

import { Button, Heading, Stack, Text } from "@primer/react";
import NextLink from "next/link";

export function HomeHero() {
  return (
    <Stack direction="vertical" gap="normal" padding="none">
      <Heading as="h1" className="ctbox-hero-title">
        CTBox
      </Heading>
      <Text as="p" className="ctbox-hero-lead" style={{ maxWidth: 640 }}>
        合约行情与衍生品信息的聚合看板：技术分析、市场监控、事件合约与直播一览。数据来自公开接口聚合，仅供学习与研究参考。
      </Text>
      <Stack direction="horizontal" gap="condensed" padding="none" wrap="wrap">
        <Button as={NextLink} href="/analysis" variant="primary">
          技术分析
        </Button>
        <Button as={NextLink} href="/monitor" variant="default">
          市场监控
        </Button>
        <Button as={NextLink} href="/calc" variant="default">
          合约计算器
        </Button>
      </Stack>
    </Stack>
  );
}
