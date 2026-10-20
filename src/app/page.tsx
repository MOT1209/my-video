"use client";

import type { NextPage } from "next";
import { ShortsEditor } from "../components/ShortsEditor";
import { Tips } from "../components/Tips";

const Home: NextPage = () => {
  return (
    <main>
      <div className="max-w-screen-md lg:max-w-6xl m-auto mb-5 px-4 mt-16 flex flex-col gap-10">
        <h1 className="sr-only">my-video: مولّد فيديوهات Shorts عمودية من النص</h1>
        <ShortsEditor />
        <Tips></Tips>
      </div>
    </main>
  );
};

export default Home;
