"use client"

import { useState } from "react";
import apiClient from "@/libs/api";

const UserProfile = () => {
  const [isLoading, setIsLoading] = useState(false);

  const saveUser = async () => {
    setIsLoading(true);

    try {
      const { data } = await apiClient.post("/user", {
        email: "xsj706@gmail.com",
      });
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button className="btn btn-primary" onClick={() => saveUser()}>
      {isLoading && (
        <span className="loading loading-spinner loading-sm"></span>
      )}
      Save
    </button>
  );
};

export default UserProfile;
