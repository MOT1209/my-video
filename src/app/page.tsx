"use client";

import type { NextPage } from "next";
import { ShortsEditor } from "../components/ShortsEditor";
import { Tips } from "../components/Tips";

const Home: NextPage = () => {
  return (
    <div>
      <div className="max-w-screen-md m-auto mb-5 px-4 mt-16 flex flex-col gap-10">
        <ShortsEditor />
        <Tips></Tips>
      </div>
    </div>
  );
};

export default Home;
